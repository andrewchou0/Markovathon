"""Generate locally with Kokoro; model-native timing keeps phrase captions aligned.

Usage: python scripts/generate-neural-narration.py --model MODEL.onnx --voices VOICES.bin
Requires kokoro-onnx==0.6.1 and soundfile. English v1.0 model from the
kokoro-onnx model-files-v1.1 release exposes the required duration output.
"""
from pathlib import Path
import argparse, json, math, subprocess
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
import onnxruntime as ort

parser=argparse.ArgumentParser()
parser.add_argument('--model',required=True)
parser.add_argument('--voices',required=True)
parser.add_argument('--voice',default='af_heart')
parser.add_argument('--only',default='')
args=parser.parse_args()
project=Path(__file__).resolve().parents[1]
audio_dir=project/'public/audio'
qa=project/'.qa/neural-narration'
audio_dir.mkdir(parents=True,exist_ok=True)
qa.mkdir(parents=True,exist_ok=True)
groups=json.loads((project/'scripts/narration-script.json').read_text())
if args.only and args.only not in {group['id'] for group in groups}:
    parser.error('--only must name a passage from narration-script.json')
ort.disable_telemetry_events()
opts=ort.SessionOptions()
opts.intra_op_num_threads=4
opts.inter_op_num_threads=1
session=ort.InferenceSession(args.model,sess_options=opts,providers=['CPUExecutionProvider'])
kokoro=Kokoro.from_session(session,args.voices)
assert kokoro.has_timings, 'Use the English v1.0 export from model-files-v1.1.'
clips=[]
captions=[]
if args.only:
    # Keep other passages and their exact timings/audio. Only the selected
    # passage is synthesized; all portable exports are refreshed together.
    selected=next(group for group in groups if group['id']==args.only)
    clips=[clip for clip in json.loads((project/'src/data/narration.json').read_text()) if clip['id']!=args.only]
    captions=[caption for caption in json.loads((project/'src/data/captions.json').read_text()) if not selected['start']*1000<=caption['startMs']<selected['end']*1000]
sample_rate=24000
mix=np.zeros(120*sample_rate,dtype=np.float32)
for group in groups:
    if args.only and group['id']!=args.only: continue
    # Form a single model utterance while retaining exact phrase/phoneme boundaries.
    phrases=[kokoro.tokenizer.phonemize(line,lang='en-us') for line in group['lines']]
    phonemes=' '.join(phrases)
    cache=qa/f"{group['id']}-{args.voice}.npz"
    start_frame=math.ceil(group['start']*60)
    start=start_frame/60
    available=group['end']-start-.08
    speed=.96
    cached=np.load(cache,allow_pickle=False) if cache.exists() else None
    cached_timing=json.loads(str(cached['timing'])) if cached is not None else []
    if cached is not None and len(cached['audio'])/sample_rate<=available and ''.join(item['phoneme'] for item in cached_timing)==phonemes:
        audio=cached['audio']; speed=float(cached['speed'])
        timing=cached_timing
    else:
        for attempt in range(6):
            audio,sample_rate,spoken=kokoro.create_timed(phonemes,voice=args.voice,speed=speed,lang='en-us',is_phonemes=True,sentence_pause=.25,clause_pause=.12)
            timing=[{'phoneme':t.phoneme,'start':t.start,'end':t.end} for t in spoken]
            print(f"  {group['id']} take {attempt+1}: {len(audio)/sample_rate:.3f}s at speed {speed:.3f}",flush=True)
            if len(audio)/sample_rate<=available: break
            speed*=len(audio)/sample_rate/available*1.015
            assert speed<1.4, f"{group['id']} would need unnatural speed {speed:.2f}"
        np.savez_compressed(cache,audio=audio,speed=speed,timing=json.dumps(timing))
    assert len(audio)/sample_rate<=available+.01,(group['id'],len(audio)/sample_rate,available)
    actual_phonemes=''.join(t['phoneme'] for t in timing)
    assert actual_phonemes==phonemes,(group['id'],actual_phonemes,phonemes)
    raw=qa/f"{group['id']}-raw.wav"
    sf.write(raw,audio,sample_rate,subtype='PCM_16')
    output=audio_dir/f"{group['id']}.wav"
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-af','loudnorm=I=-18:TP=-2:LRA=7','-ar',str(sample_rate),'-ac','1','-c:a','pcm_s16le',str(output)],check=True)
    normalized,sr=sf.read(output,dtype='float32')
    assert sr==sample_rate
    duration=len(normalized)/sr
    end=start+duration
    assert end<=group['end']+.01,(group['id'],end,group['end'])
    mix[round(start*sr):round(start*sr)+len(normalized)]=normalized
    clips.append({'id':group['id'],'text':' '.join(group['lines']),'file':f'audio/{group["id"]}.wav','voice':args.voice,'model':'Kokoro-82M v1.0','speed':round(speed,5),'startFrame':start_frame,'durationInFrames':math.ceil(duration*60),'audioDurationSeconds':round(duration,6),'startMs':start*1000,'endMs':end*1000})
    cursor=0
    for line,phrase in zip(group['lines'],phrases):
        line_timings=timing[cursor:cursor+len(phrase)]
        assert ''.join(t['phoneme'] for t in line_timings)==phrase
        captions.append({'text':line,'startMs':round((start+line_timings[0]['start'])*1000,3),'endMs':round(min(end,start+line_timings[-1]['end']+.16)*1000,3),'timestampMs':None,'confidence':None})
        cursor+=len(phrase)+1
    print(f"{group['id']:12s} {start:7.3f}–{end:7.3f}s | model speed {speed:.3f}",flush=True)
clips.sort(key=lambda clip:clip['startFrame'])
captions.sort(key=lambda caption:caption['startMs'])
for a,b in zip(captions,captions[1:]): a['endMs']=min(a['endMs'],b['startMs'])
assert all(a['endMs']<=b['startMs'] for a,b in zip(captions,captions[1:]))
mix=np.zeros(120*sample_rate,dtype=np.float32)
for clip in clips:
    audio,sr=sf.read(project/'public'/clip['file'],dtype='float32')
    assert sr==sample_rate
    start=round(clip['startFrame']/60*sr)
    mix[start:start+len(audio)]=audio
assert not np.any(mix[66*sample_rate:round(74.409*sample_rate)])
assert not np.any(mix[117*sample_rate:])
assert len(clips)==len(groups) and len(captions)==sum(len(group['lines']) for group in groups)
(project/'src/data/narration.json').write_text(json.dumps(clips,indent=2)+'\n')
for target in [project/'src/data/captions.json',project/'public/captions.json']:
    target.write_text(json.dumps(captions,indent=2,ensure_ascii=False)+'\n')
def stamp(ms):
    ms=round(ms); hours,ms=divmod(ms,3600000);minutes,ms=divmod(ms,60000);seconds,ms=divmod(ms,1000)
    return f'{hours:02}:{minutes:02}:{seconds:02},{ms:03}'
srt='\n\n'.join(f'{i+1}\n{stamp(c["startMs"])} --> {stamp(c["endMs"])}\n{c["text"]}' for i,c in enumerate(captions))+'\n'
(project/'public/captions.srt').write_text(srt)
sf.write(audio_dir/'narration-reference.wav',mix,sample_rate,subtype='PCM_16')
print(f'Saved {len(clips)} connected voice passages, {len(captions)} model-aligned captions, and a 120-second reference mix.',flush=True)
