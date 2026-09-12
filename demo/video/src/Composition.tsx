import React from 'react';
import {TransitionSeries} from '@remotion/transitions';
import {Problem} from './scenes/Problem';
import {DataSources} from './scenes/DataSources';
import {Cascade} from './scenes/Cascade';
import {Monitor} from './scenes/Monitor';
import {Response} from './scenes/Response';
import {Value} from './scenes/Value';
import {StageTransition} from './StageTransition';
import {BackgroundMusic, BackgroundMusicProvided} from './BackgroundMusic';

export const MarkovDemo:React.FC = ()=> <BackgroundMusicProvided.Provider value={true}>
 <BackgroundMusic/>
 <TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={720} name="00:00 The problem"><Problem/></TransitionSeries.Sequence>
  <TransitionSeries.Overlay durationInFrames={32}><StageTransition/></TransitionSeries.Overlay>
  <TransitionSeries.Sequence durationInFrames={1080} name="00:12 Supplier records"><DataSources/></TransitionSeries.Sequence>
  <TransitionSeries.Overlay durationInFrames={32}><StageTransition/></TransitionSeries.Overlay>
  <TransitionSeries.Sequence durationInFrames={1500} name="00:30 The cascade"><Cascade/></TransitionSeries.Sequence>
  <TransitionSeries.Overlay durationInFrames={32}><StageTransition/></TransitionSeries.Overlay>
  <TransitionSeries.Sequence durationInFrames={1320} name="00:55 Unattended monitor"><Monitor/></TransitionSeries.Sequence>
  <TransitionSeries.Overlay durationInFrames={32}><StageTransition/></TransitionSeries.Overlay>
  <TransitionSeries.Sequence durationInFrames={1260} name="01:17 Draft and fallback"><Response/></TransitionSeries.Sequence>
  <TransitionSeries.Overlay durationInFrames={32}><StageTransition/></TransitionSeries.Overlay>
  <TransitionSeries.Sequence durationInFrames={1320} name="01:38 Business value"><Value/></TransitionSeries.Sequence>
</TransitionSeries>
</BackgroundMusicProvided.Provider>;
