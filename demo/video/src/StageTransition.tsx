import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

// An overlay conceals the cut without overlapping the scenes' narration clocks
// or shortening the fixed two-minute timeline. The app shell remains anchored.
export const StageTransition:React.FC = () => {
  const f=useCurrentFrame();
  return <div style={{position:'absolute',inset:'102px 0 264px',overflow:'hidden',pointerEvents:'none'}}>
    <div style={{position:'absolute',inset:0,background:'#f5f7fa',borderLeft:'12px solid #285bd0',boxShadow:'-24px 0 0 #dfe9fb',translate:interpolate(f,[0,16,32],['-1970px 0px','0px 0px','1970px 0px'],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),zIndex:10}}/>
  </div>;
};
