import React, {createContext} from 'react';
import {Audio} from '@remotion/media';
import {interpolate, staticFile, useCurrentFrame} from 'remotion';
import clips from './data/narration.json';

export const BackgroundMusicProvided = createContext(false);
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;

export const backgroundMusicVolume=(frame:number)=>{
  const speech=Math.max(0,...clips.map(clip=>interpolate(frame,
    [clip.startFrame-15,clip.startFrame,clip.startFrame+clip.durationInFrames,clip.startFrame+clip.durationInFrames+42],
    [0,1,1,0],clamp)));
  const fade=interpolate(frame,[0,90,7020,7199],[0,1,1,0],clamp);
  // The music source and voice are normalized to -18 LUFS. This leaves the
  // music about 14 dB below speech, with a restrained lift between passages.
  return interpolate(speech,[0,1],[.29,.20],clamp)*fade;
};

export const BackgroundMusic:React.FC<{offsetInFrames?:number}>=({offsetInFrames=0})=>{
  const frame=useCurrentFrame()+offsetInFrames;
  return <Audio
    src={staticFile("audio/background-music.mp3")}
    trimBefore={offsetInFrames}
    volume={backgroundMusicVolume(frame)}
  />;
};
