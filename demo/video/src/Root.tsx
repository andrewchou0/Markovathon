import React from 'react';
import {Composition, Folder} from 'remotion';
import './index.css';
import {MarkovDemo} from './Composition';
import {Problem} from './scenes/Problem';
import {DataSources} from './scenes/DataSources';
import {Cascade} from './scenes/Cascade';
import {Monitor} from './scenes/Monitor';
import {Response} from './scenes/Response';
import {Value} from './scenes/Value';
export const RemotionRoot:React.FC = ()=><>
 <Composition id="MarkovDemo" component={MarkovDemo} durationInFrames={7200} fps={60} width={1920} height={1080}/>
 <Folder name="Scenes">
  <Composition id="Problem" component={Problem} durationInFrames={720} fps={60} width={1920} height={1080}/>
  <Composition id="SupplierRecords" component={DataSources} durationInFrames={1080} fps={60} width={1920} height={1080}/>
  <Composition id="Cascade" component={Cascade} durationInFrames={1500} fps={60} width={1920} height={1080}/>
  <Composition id="UnattendedMonitor" component={Monitor} durationInFrames={1320} fps={60} width={1920} height={1080}/>
  <Composition id="DraftAndFallback" component={Response} durationInFrames={1260} fps={60} width={1920} height={1080}/>
  <Composition id="BusinessValue" component={Value} durationInFrames={1320} fps={60} width={1920} height={1080}/>
 </Folder>
</>;
