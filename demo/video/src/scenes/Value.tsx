import React from 'react';
import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import {Arrow, Caption, CascadeGraph, Check, Heading, Shell, clamp, colors} from '../ui';
import mitigation from '../data/mitigation.json';

const outcomes=[{text:'Stock',at:2.9},{text:'Schedule',at:4},{text:'Orders',at:5},{text:'Quality',at:6}];
const amount=(value:number)=>`$${value.toLocaleString('en-US')}`;
const responseAt=6.7;

const ClosingPipeline:React.FC = ()=>{
 const stages=[
  {title:'Operational context',sub:'Stock, orders, schedules'},
  {title:'Impact analysis',sub:'Costs and deadlines'},
  {title:'Response planning',sub:'Compare feasible options'},
  {title:'Human approval',sub:'Review proposed actions'},
  {title:'Reassessment',sub:'Monitor changing conditions'},
 ];
 return <Interactive.Div name="Continuous operating response" style={{position:'absolute',zIndex:1,left:64,right:64,bottom:30,height:123,background:'#151922',borderRadius:12,padding:'20px 26px',display:'flex',alignItems:'center',gap:18}}>
  <div style={{width:172,flexShrink:0,color:'#b3bdd0',fontSize:20,lineHeight:1.5}}>Operating flow<br/><span style={{fontSize:18,color:'#a7b4ca'}}>Continuous response</span></div>
  {stages.map((stage,i)=><React.Fragment key={stage.title}><div style={{flex:1,minWidth:0,height:82,borderRadius:8,padding:'13px 16px',position:'relative',overflow:'hidden',background:i===3?'#242a36':'#263d62',border:i===3?'1px solid #b98b3c':'1px solid transparent',color:'#eceef4'}}><strong style={{fontSize:22,fontWeight:600,display:'block',whiteSpace:'nowrap'}}>{stage.title}</strong><span style={{fontSize:17,color:i===3?'#f5c875':'#b6c4db',display:'block',marginTop:5,whiteSpace:'nowrap'}}>{stage.sub}</span><div style={{position:'absolute',bottom:0,left:0,height:3,width:'100%',background:i===3?'#d7a449':'#8cb5ff'}}/></div>{i<4&&<span style={{color:'#7d8ba5'}}><Arrow/></span>}</React.Fragment>)}
 </Interactive.Div>;
};

export const Value:React.FC = ()=>{
 const f=useCurrentFrame();
 return <Shell time={98+f/60}>
  <Heading title="Keep production moving through a disruption" sub=""/>
  <div style={{position:'absolute',left:80,right:80,top:206,height:47,display:'flex',alignItems:'center',gap:16}}>{outcomes.map((outcome,i)=><React.Fragment key={outcome.text}><Interactive.Div name={outcome.text} style={{position:'relative',flex:1,height:47,display:'flex',alignItems:'center',justifyContent:'center',gap:10,border:`1px solid ${f>=outcome.at*60?'#bed0ee':colors.line}`,borderRadius:7,background:'white',overflow:'hidden',opacity:interpolate(f,[i*6,i*6+25],[0,1],clamp),translate:interpolate(f,[i*6,i*6+25],['0px 10px','0px 0px'],clamp)}}><span style={{position:'absolute',left:0,top:0,bottom:0,width:`${interpolate(f,[outcome.at*60,outcome.at*60+35],[0,100],clamp)}%`,background:'#eaf1fd'}}/><span style={{position:'relative',fontSize:21,fontWeight:600,color:f>=outcome.at*60?colors.blue:colors.muted}}>{outcome.text}</span></Interactive.Div>{i<3&&<span style={{color:f>=outcomes[i+1].at*60?colors.blue:'#b4c1d2',fontSize:27,fontWeight:400}}>+</span>}</React.Fragment>)}</div>
  <div style={{position:'absolute',inset:0,opacity:interpolate(f,[responseAt*60,(responseAt+.4)*60],[1,0],clamp),pointerEvents:'none'}}>
   <CascadeGraph reveals={[.4,1.8,3.2,4.6]} riskAt={5.2} showRisk={false} showReceipt={false}/>
  </div>
  <Interactive.Div name="Recommended operating response" style={{position:'absolute',left:80,right:80,top:298,height:472,display:'grid',gridTemplateColumns:'1.42fr 1fr',gap:24,opacity:interpolate(f,[responseAt*60,(responseAt+.45)*60],[0,1],clamp),translate:interpolate(f,[responseAt*60,(responseAt+.55)*60],['0px 14px','0px 0px'],clamp)}}>
   <div style={{background:'white',border:`1px solid ${colors.line}`,borderRadius:12,padding:'29px 30px'}}>
    <div style={{fontSize:20,color:colors.muted,marginBottom:29}}>Recommended operating response</div>
    {[{title:'Protect the priority order',text:`Reserve ${mitigation.finishedModulesForPriority} finished modules + ${mitigation.sensorsForPriority} released sensors.`,at:6.9},{title:'Release independent kit production',text:`Build ${mitigation.standardModulesBuilt} standard modules; park the rest, then ${mitigation.changeoverHours}h changeover + ${mitigation.kitsBuilt} kits.`,at:8.8}].map((step,i)=><Interactive.Div key={step.title} name={step.title} style={{display:'flex',alignItems:'flex-start',gap:18,padding:'22px 0',borderTop:i?`1px solid ${colors.line}`:'none',opacity:interpolate(f,[step.at*60,(step.at+.4)*60],[0,1],clamp),translate:interpolate(f,[step.at*60,(step.at+.45)*60],['12px 0px','0px 0px'],clamp)}}><span style={{width:35,height:35,borderRadius:18,background:'#eaf1fd',color:colors.blue,fontSize:21,fontWeight:650,display:'grid',placeItems:'center',flexShrink:0,marginTop:2}}>{i+1}</span><div><h3 style={{fontSize:29,lineHeight:1.3,letterSpacing:-.4,margin:'0 0 11px',fontWeight:650}}>{step.title}</h3><p style={{fontSize:23,lineHeight:1.5,color:colors.muted,margin:0}}>{step.text}</p></div></Interactive.Div>)}
    <div style={{display:'flex',gap:10,alignItems:'center',marginTop:20,fontSize:21,color:colors.blue,opacity:interpolate(f,[14.088*60,14.6*60],[0,1],clamp)}}><Check color={colors.blue} size={23}/>Review the plan. Reassess as conditions change.</div>
   </div>
   <div style={{background:'#f0f5fd',border:'1px solid #cad8ee',borderRadius:12,padding:'29px 30px'}}>
    <div style={{fontSize:20,color:colors.muted,marginBottom:35}}>{mitigation.horizonHours}-hour worked example</div>
    <div style={{fontSize:22,color:colors.muted,marginBottom:12}}>Modeled late fees + setup</div>
    <div style={{display:'flex',alignItems:'center',gap:21,whiteSpace:'nowrap',opacity:interpolate(f,[9.6*60,10.15*60],[0,1],clamp)}}><span style={{fontSize:39,fontWeight:550,letterSpacing:-1,color:colors.muted}}>{amount(mitigation.baselineCost)}</span><span style={{color:colors.blue}}><Arrow/></span><strong style={{fontSize:54,fontWeight:650,letterSpacing:-1.7,color:colors.ink}}>{amount(mitigation.recommendedCost)}</strong></div>
    <div style={{borderTop:'1px solid #cad8ee',paddingTop:28,marginTop:31,opacity:interpolate(f,[10.928*60,11.45*60],[0,1],clamp)}}><strong style={{fontSize:39,fontWeight:650,letterSpacing:-.8,color:colors.green}}>+{mitigation.productiveHoursRecovered} productive hours</strong><p style={{fontSize:22,color:colors.muted,margin:'12px 0 0'}}>Use available capacity while the shortage remains.</p></div>
   </div>
  </Interactive.Div>
  <Interactive.Div name="Mitigation outcome and remaining exception" style={{position:'absolute',left:80,right:80,top:785,height:30,display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,fontSize:21,opacity:interpolate(f,[10.928*60,11.45*60],[0,1],clamp),translate:interpolate(f,[10.928*60,11.45*60],['0px 8px','0px 0px'],clamp)}}><span style={{display:'flex',alignItems:'center',gap:8,color:colors.green}}><Check size={22}/>{mitigation.priorityOnTime} priority modules on time</span><span style={{color:colors.amber}}>{mitigation.standardLate} standard modules still late</span><span style={{color:colors.muted}}>Proposed for human approval</span></Interactive.Div>
  <Caption text="Protect commitments · keep production moving · reassess"/>
  <ClosingPipeline/>
 </Shell>;
};
