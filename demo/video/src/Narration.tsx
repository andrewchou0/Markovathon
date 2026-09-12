import React, {createContext, useContext} from 'react';
import {Audio} from '@remotion/media';
import type {Caption} from '@remotion/captions';
import {interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import captionData from './data/captions.json';
import clips from './data/narration.json';
import {BackgroundMusic, BackgroundMusicProvided} from './BackgroundMusic';

const SpokenCaptionContext = createContext(false);
export const useSpokenCaption = () => useContext(SpokenCaptionContext);
const captions:Caption[] = captionData;

// Connected neural voice passages and their model-timed captions share the
// absolute scene clock in both the full video and individual compositions.
export const Narration:React.FC<React.PropsWithChildren<{time:number}>> = ({time,children}) => {
  const frame=useCurrentFrame();
  const hasBackgroundMusic=useContext(BackgroundMusicProvided);
  const sceneStartFrame=Math.round(time*60)-frame;
  const sceneEndFrame=[720,1800,3300,4620,5880,7200].find(end=>end>sceneStartFrame)??7200;
  const active = captions.find(caption => time*1000 >= caption.startMs && time*1000 < caption.endMs);
  return <SpokenCaptionContext.Provider value={Boolean(active)}>
    {children}
    {!hasBackgroundMusic&&<BackgroundMusic offsetInFrames={sceneStartFrame}/>}
    {clips.filter(clip=>clip.startFrame>=sceneStartFrame&&clip.startFrame<sceneEndFrame).map(clip=>
      <Sequence key={clip.id} from={clip.startFrame-sceneStartFrame} durationInFrames={clip.durationInFrames} name={`Kokoro voice · ${clip.id}`} layout="none">
        <Audio src={staticFile(clip.file)} volume={1}/>
      </Sequence>
    )}
    {active && <div data-spoken-caption="true" aria-label="Script caption" style={{position:'absolute',left:80,right:80,top:830,height:82,padding:'5px 24px',borderRadius:8,background:'#203047',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'"Avenir Next", "Segoe UI", sans-serif',fontSize:30,fontWeight:500,lineHeight:1.2,textAlign:'center',textWrap:'balance',zIndex:5,opacity:interpolate(time*1000,[active.startMs,active.startMs+90],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>{active.text}</div>}
  </SpokenCaptionContext.Provider>;
};
