import React from 'react';
import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import {Caption, CascadeGraph, Heading, Shell, clamp, colors} from '../ui';
export const Cascade:React.FC = ()=>{
 const f=useCurrentFrame();
 const labels=['Disruption received','Direct supplier identified','Tier 1 traced','Tier 2 traced','Finished product exposed','Impact calculated'];
 const stage=f>=21*60?5:f>=17.9*60?4:f>=14.4*60?3:f>=11.1*60?2:f>=5.4*60?1:0;
 return <Shell time={30+f/60}>
  <Heading title="One decision. Three tiers of exposure." sub=""/>
  <Interactive.Div name="Disruption enters the network" style={{position:'absolute',left:80,right:80,top:210,height:58,padding:'13px 18px',border:'1px solid #e7c48b',borderRadius:8,background:'#fff4de',fontSize:22,display:'flex',gap:20,alignItems:'center',opacity:interpolate(f,[8,32],[0,1],clamp),translate:interpolate(f,[8,42],['-40px 0px','0px 0px'],clamp)}}>
   <span style={{width:10,height:10,borderRadius:10,background:colors.red,boxShadow:f<120?`0 0 0 ${interpolate(f,[25,100],[0,12],clamp)}px #b33b3415`:'none'}}/>
   <strong style={{color:colors.amber}}>High severity</strong>
   <span>evt_004 · Export licence suspended · Antofagasta, Chile</span>
   <span style={{marginLeft:'auto',fontSize:19,color:colors.amber,fontWeight:600}}>{labels[stage]}</span>
  </Interactive.Div>
  <CascadeGraph reveals={[5.4,11.1,14.4,17.9]} riskAt={19.5}/>
  <Interactive.Div name="Direct supplier vulnerability" style={{position:'absolute',left:90,top:660,width:340,padding:'16px 20px',borderLeft:`3px solid ${colors.red}`,background:'#fff1ed',fontSize:20,lineHeight:1.55,color:colors.red,opacity:interpolate(f,[6.1*60,6.7*60],[0,1],clamp),translate:interpolate(f,[6.1*60,6.7*60],['-16px 0px','0px 0px'],clamp)}}>No recorded alternate<br/>Already non-compliant</Interactive.Div>
  <Caption text={stage<5?'Follow the dependency links · identify every affected supplier':'Network risk 0.961 · 3 downstream tiers · 6 affected suppliers'}/>
 </Shell>;
};
