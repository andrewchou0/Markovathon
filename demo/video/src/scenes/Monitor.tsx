import React from 'react';
import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import autonomy from '../data/autonomy.json';
import {Caption, Check, Heading, Shell, clamp, colors} from '../ui';

export const Monitor: React.FC = () => {
 const f=useCurrentFrame();const seconds=f/60;const insertAt=11;const delay=autonomy.discovery_seconds-autonomy.insert_seconds;const discovered=seconds>=insertAt+delay;const waiting=seconds>=insertAt&&!discovered;
 const existing=autonomy.activity.filter(row=>'event_id' in row && row.event_id!=='evt_005');
 const newEvent=autonomy.activity[0];
 const discoveryFrame=(insertAt+delay)*60;
 const phase=discovered?(f>=discoveryFrame+40?4:3):waiting?(seconds>=insertAt+.85?2:1):0;
 const elapsed=waiting?Math.min(delay,seconds-insertAt):discovered?delay:0;
 const steps=['Monitoring','Event added','Timer wait','Detected','Flagged'];
 const circumference=2*Math.PI*79;
 const linear={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;

 return <Shell time={55+seconds}>
  <Heading title="It checks without being asked" sub="A recorded local check: the timer finds a new disruption and flags it for review."/>

  <Interactive.Div name="Monitor journey" style={{position:'absolute',left:80,right:80,top:232,height:42,display:'flex',alignItems:'center',gap:18,opacity:interpolate(f,[0,20],[0,1],clamp),translate:interpolate(f,[0,20],['0px 10px','0px 0px'],clamp)}}>
   {steps.map((label,index)=><React.Fragment key={label}>
    <div style={{display:'flex',alignItems:'center',gap:11,fontSize:21,fontWeight:phase===index?650:500,color:index<=phase?colors.ink:colors.muted,whiteSpace:'nowrap'}}>
     <span style={{width:31,height:31,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,background:index<phase?'#e8f3ed':index===phase?colors.blue:'#e8edf4',color:index===phase?'#fff':colors.muted}}>{index<phase?<Check size={18}/>:index+1}</span>{label}
    </div>
    {index<4&&<div style={{flex:1,height:2,background:colors.line,position:'relative',overflow:'hidden'}}><div style={{position:'absolute',inset:0,background:colors.blue,scale:`${index<phase?1:0} 1`,transformOrigin:'left center'}}/></div>}
   </React.Fragment>)}
  </Interactive.Div>

  <Interactive.Div name="Recorded agent activity" style={{position:'absolute',left:80,top:296,width:1120,height:510,background:'white',border:`1px solid ${colors.line}`,borderRadius:12,overflow:'hidden',opacity:interpolate(f,[8,30],[0,1],clamp),translate:interpolate(f,[8,30],['0px 18px','0px 0px'],clamp)}}>
   <div style={{height:72,padding:'0 30px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${colors.line}`}}>
    <div style={{display:'flex',alignItems:'center',gap:14}}><strong style={{fontSize:27}}>Agent activity</strong><span style={{fontSize:18,color:colors.muted,background:'#f1f4f8',padding:'5px 10px',borderRadius:5}}>{discovered?'5':'4'} assessed</span></div>
    <span style={{fontSize:19,color:colors.muted}}>Latest first · recorded UTC</span>
   </div>

   {existing.map((row,index)=>{
    const suppressed=row.action==='assessed_no_alert';
    return <Interactive.Div name={`Recorded assessment ${row.event_id}`} key={row.event_id} style={{position:'absolute',left:24,right:24,top:73+index*78,height:78,display:'flex',alignItems:'center',gap:17,borderBottom:`1px solid ${colors.line}`,padding:'0 12px',translate:interpolate(f,[discoveryFrame,discoveryFrame+24],['0px 0px','0px 78px'],clamp),opacity:interpolate(f,[32+index*11,52+index*11],[0,1],clamp)}}>
     <span style={{fontSize:18,color:colors.muted,minWidth:83,fontVariantNumeric:'tabular-nums'}}>{row.at.slice(11,19)}</span>
     <div style={{flex:1}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:15,fontSize:22,fontWeight:550}}><span>{row.event_id}</span><span style={{fontSize:19,fontWeight:500,color:suppressed?colors.muted:colors.amber}}>{suppressed?'Suppressed':'Flagged · delivery unavailable'}</span></div><p style={{fontSize:19,color:colors.muted,margin:'5px 0 0'}}>{row.reason}</p></div>
     {suppressed?<Check color="#67768b" size={21}/>:<span style={{width:8,height:8,borderRadius:8,background:colors.amber}}/>}
    </Interactive.Div>;
   })}

   <Interactive.Div name="New disruption received by fixture feed" style={{position:'absolute',left:30,right:30,top:404,height:84,border:'1px solid #adc3ef',background:'#edf4ff',borderRadius:9,padding:'15px 18px',display:'flex',alignItems:'center',gap:18,opacity:interpolate(f,[insertAt*60,insertAt*60+18,discoveryFrame-5,discoveryFrame+8],[0,1,1,0],clamp),translate:interpolate(f,[insertAt*60,insertAt*60+26],['-55px 0px','0px 0px'],clamp)}}>
    <div style={{width:42,height:42,background:colors.blue,color:'white',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,lineHeight:1}}>+</div>
    <div style={{flex:1}}><strong style={{fontSize:22,fontWeight:600}}>New disruption · evt_005</strong><p style={{fontSize:19,color:colors.muted,margin:'4px 0 0'}}>Typhoon disrupts freight · added to the fixture feed</p></div>
    <div style={{fontSize:18,color:colors.blue,textAlign:'right',opacity:interpolate(f,[insertAt*60+22,insertAt*60+40],[0,1],clamp)}}><span style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:7}}><Check color={colors.blue} size={18}/>Event added</span><span style={{display:'block',marginTop:5,color:colors.muted}}>No manual scan</span></div>
   </Interactive.Div>

   <Interactive.Div name="Discovered disruption joins the audit trail" style={{position:'absolute',left:24,right:24,top:73,height:78,display:'flex',alignItems:'center',gap:17,padding:'0 12px',borderBottom:'1px solid #c6d6f1',background:'#edf4ff',opacity:interpolate(f,[discoveryFrame,discoveryFrame+18],[0,1],clamp),translate:interpolate(f,[discoveryFrame,discoveryFrame+25],['-45px 0px','0px 0px'],clamp)}}>
    <span style={{fontSize:18,color:colors.muted,minWidth:83,fontVariantNumeric:'tabular-nums'}}>{newEvent.at.slice(11,19)}</span>
    <div style={{flex:1}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:15,fontSize:22,fontWeight:650}}><span>evt_005 · Typhoon disrupts freight</span><span style={{fontSize:19,color:phase===4?colors.amber:colors.blue,fontWeight:500}}>{phase===4?'Flagged · delivery unavailable':'New event assessed'}</span></div><p style={{fontSize:19,color:colors.muted,margin:'5px 0 0'}}>{newEvent.reason}</p></div><span style={{width:8,height:8,borderRadius:8,background:phase===4?colors.amber:colors.blue}}/>
    <div style={{position:'absolute',top:0,bottom:0,width:120,left:0,pointerEvents:'none',background:'linear-gradient(90deg, transparent, #285bd016, transparent)',translate:interpolate(f,[discoveryFrame,discoveryFrame+50],['-120px 0px','1080px 0px'],linear),opacity:interpolate(f,[discoveryFrame,discoveryFrame+8,discoveryFrame+45,discoveryFrame+50],[0,1,1,0],clamp)}}/>
   </Interactive.Div>

   <div style={{position:'absolute',left:34,right:34,bottom:21,display:'flex',alignItems:'center',gap:10,fontSize:19,color:colors.muted,opacity:interpolate(f,[insertAt*60-18,insertAt*60],[1,0],clamp)}}><span style={{width:7,height:7,borderRadius:5,background:colors.green}}/>Routine events are logged. Higher-impact events are flagged.</div>
  </Interactive.Div>

  <Interactive.Div name="Timer and next action" style={{position:'absolute',left:1240,right:80,top:296,height:510,border:`1px solid ${colors.line}`,borderRadius:12,padding:'24px 28px',background:'#fff',opacity:interpolate(f,[18,40],[0,1],clamp),translate:interpolate(f,[18,40],['24px 0px','0px 0px'],clamp)}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><h3 style={{fontSize:27,margin:0}}>Unattended check</h3><span style={{fontSize:18,color:discovered?colors.green:colors.blue,background:discovered?'#e8f3ed':'#edf4ff',padding:'5px 9px',borderRadius:5}}>{discovered?'Assessed':waiting?'Waiting':'Running'}</span></div>

   <div style={{position:'absolute',left:193,top:81,width:210,height:210}}>
    <svg width={210} height={210} viewBox="0 0 210 210" style={{overflow:'visible'}}>
     <circle cx={105} cy={105} r={79} stroke="#e9eef5" strokeWidth={7} fill="none"/>
     <circle cx={105} cy={105} r={79} stroke={discovered?colors.green:colors.blue} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={circumference} strokeDashoffset={waiting||discovered?circumference*(1-elapsed/delay):circumference*.85} style={{rotate:waiting||discovered?'-90deg':`${interpolate(f%480,[0,480],[-90,270],linear)}deg`,transformOrigin:'105px 105px'}}/>
     {discovered&&<circle cx={105} cy={105} r={79} stroke={colors.green} strokeWidth={2} fill="none" style={{opacity:interpolate(f,[discoveryFrame,discoveryFrame+38],[.6,0],clamp),scale:interpolate(f,[discoveryFrame,discoveryFrame+38],[1,1.2],clamp),transformOrigin:'105px 105px'}}/>}
    </svg>
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><strong style={{fontSize:49,fontVariantNumeric:'tabular-nums',fontWeight:650,letterSpacing:-2,color:discovered?colors.green:colors.ink}}>{discovered?delay.toFixed(2):waiting?Math.min(delay,seconds-insertAt).toFixed(2):'8.00'}<span style={{fontSize:21,letterSpacing:0,fontWeight:500,color:colors.muted}}> s</span></strong><span style={{fontSize:18,color:colors.muted,marginTop:5}}>{discovered?'to discovery':waiting?'elapsed':'poll interval'}</span></div>
   </div>

   <div style={{position:'absolute',left:28,right:28,top:288,textAlign:'center',fontSize:21,lineHeight:1.4,color:discovered?colors.green:colors.muted}}>{discovered?'Discovered on the next timer tick':waiting?'Event queued. The agent checks on its next tick.':'The agent checks the feed on a timer.'}</div>

   <Interactive.Div name="What the agent does next" style={{position:'absolute',left:28,right:28,top:355,minHeight:92,background:phase===4?'#fff8ea':discovered?'#e8f3ed':'#f5f7fa',borderRadius:8,padding:'16px 18px',border:`1px solid ${phase===4?'#e6d3aa':discovered?'#c7dfcf':colors.line}`,translate:discovered?interpolate(f,[discoveryFrame,discoveryFrame+20],['0px 6px','0px 0px'],clamp):'0px 0px'}}>
    <strong style={{fontSize:23,fontWeight:600,color:phase===4?colors.amber:discovered?colors.green:colors.ink}}>{phase===4?'Flagged for human review':discovered?'Impact assessed':waiting?'No click. No manual scan.':'Only meaningful disruptions rise to the top.'}</strong>
    <p style={{fontSize:19,lineHeight:1.4,margin:'7px 0 0',color:colors.muted}}>{discovered?'Risk 0.726 · 3 affected suppliers':waiting?'The recorded daemon thread continues on its own.':'Each assessment keeps its score and reason.'}</p>
   </Interactive.Div>
   <div style={{position:'absolute',left:28,right:28,bottom:20,display:'flex',alignItems:'center',gap:8,fontSize:18,color:colors.amber}}><span style={{width:6,height:6,borderRadius:6,background:colors.amber}}/>Approval transport disconnected · nothing sent</div>
  </Interactive.Div>

  <Caption text={discovered?'5 assessed · 3 flagged · 2 suppressed · 0 delivered':waiting?'New event added · waiting for the next autonomous check':'Standalone monitor · recorded 8-second interval test'}/>
 </Shell>;
};
