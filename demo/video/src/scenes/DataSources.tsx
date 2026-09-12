import React from 'react';
import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import {Caption, Heading, Shell, clamp, colors, data} from '../ui';

const supplier=data.suppliers.find(s=>s.id==='sup_007')!;
const fields=[
  {label:'Part supplied',value:supplier.part_supplied,short:'Part',icon:'◈',at:.6,color:colors.blue},
  {label:'Compliance status',value:'Non-compliant',short:'Compliance',icon:'!',at:1.8,color:colors.red},
  {label:'Supplier location',value:supplier.location,short:'Location',icon:'◎',at:3,color:colors.blue},
  {label:'Downstream dependencies',value:'sup_005  ·  sup_008',short:'Dependencies',icon:'↳',at:4.2,color:colors.blue},
];

export const DataSources:React.FC = () => {
  const f=useCurrentFrame();
  const local=interpolate(f,[11.85*60,12.6*60],[0,1],clamp);
  const single=interpolate(f,[6.75*60,7.2*60],[0,1],clamp);
  return <Shell time={12+f/60}>
    <Heading title="The records behind the network" sub="Parts, compliance, location, and dependencies become one traceable supplier record."/>
    <div style={{position:'absolute',left:62,top:244,width:1796,height:574,border:`2px solid rgba(40,91,208,${local*.45})`,borderRadius:17,background:`rgba(40,91,208,${local*.018})`}}/>
    <div style={{position:'absolute',left:85,top:252,right:88,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:19,color:colors.muted}}><span>Fields from the local seed record</span><span style={{display:'flex',gap:9,alignItems:'center',color:colors.blue,opacity:local,background:colors.bg,padding:'0 14px'}}>▣ Local architecture · sensitive supplier data</span></div>
    <svg width={1920} height={1080} style={{position:'absolute',inset:0}}>
      {fields.map((field,i)=>{
        const startY=349+i*110; const at=field.at*60+22;
        const p=interpolate(f,[at,at+65],[0,1],clamp);
        const first=interpolate(f,[at,at+65],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
        const x=600+90*first;
        const y=startY+(514-startY)*(3*first*first-2*first*first*first);
        return <g key={field.label}>
          <path d={`M 600 ${startY} C 655 ${startY}, 640 514, 690 514`} fill="none" stroke={colors.line} strokeWidth={2}/>
          <path d={`M 600 ${startY} C 655 ${startY}, 640 514, 690 514`} fill="none" stroke={field.color} strokeWidth={2.5} pathLength={1} strokeDasharray="1" strokeDashoffset={1-p} opacity={.6}/>
          {first>0&&first<1&&<><circle cx={x} cy={y} r={12} fill={field.color} opacity={.1}/><circle cx={x} cy={y} r={4} fill={field.color}/></>}
        </g>;
      })}
      <path d="M 876 514 H 941" stroke={colors.line} strokeWidth={2}/>
      <path d="M 876 514 H 941" stroke={colors.blue} strokeWidth={3} pathLength={1} strokeDasharray="1" strokeDashoffset={1-interpolate(f,[1.9*60,6.2*60],[0,1],clamp)}/>
      <path d="m 934 508 7 6 -7 6" fill="none" stroke={colors.blue} strokeWidth={2}/>
    </svg>
    {fields.map((field,i)=>{
      const at=field.at*60;
      const current=f>=at&&f<at+80;
      return <Interactive.Div key={field.label} name={`Source field · ${field.short}`} style={{position:'absolute',left:85,top:300+i*110,width:515,height:98,padding:'17px 21px',borderRadius:10,border:`1px solid ${current?'#9bb7ed':colors.line}`,background:'#fff',display:'flex',alignItems:'center',gap:18,opacity:interpolate(f,[at,at+28],[0,1],clamp),translate:interpolate(f,[at,at+34],['-22px 0px','0px 0px'],clamp),boxShadow:current?'0 5px 22px #285bd011':'0 2px 8px #20304704'}}>
        <span style={{display:'flex',alignItems:'center',justifyContent:'center',width:47,height:47,flexShrink:0,borderRadius:9,background:field.color===colors.red?'#fff0eb':'#edf2fd',color:field.color,fontSize:29,fontWeight:550}}>{field.icon}</span>
        <div><div style={{fontSize:18,color:colors.muted,marginBottom:5}}>{field.label}</div><div style={{fontSize:23,fontWeight:600,letterSpacing:-.25,color:field.color===colors.red?colors.red:colors.ink}}>{field.value}</div></div>
      </Interactive.Div>;
    })}
    <div style={{position:'absolute',left:690,top:459,width:186,height:110,background:'#203047',color:'white',borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:7,boxShadow:'0 10px 25px #20304712',opacity:interpolate(f,[20,50],[0,1],clamp),scale:interpolate(f,[4.9*60,5.35*60,5.8*60],[1,1.04,1],clamp)}}><strong style={{fontSize:24,fontWeight:600}}>Synthesize</strong><span style={{fontSize:17,color:'#bbcee9'}}>Link the record</span></div>
    <div style={{position:'absolute',left:690,top:590,width:186,textAlign:'center',fontSize:18,color:colors.muted}}>One supplier ID<br/><span style={{color:colors.blue,fontWeight:600,lineHeight:1.9}}>sup_007</span></div>
    <Interactive.Div name="Synthesized supplier record" style={{position:'absolute',left:941,top:300,width:889,height:428,padding:'25px 29px',background:'white',border:`1px solid ${colors.line}`,borderRadius:12,boxShadow:'0 10px 30px #20304706',opacity:interpolate(f,[.7*60,1.2*60],[0,1],clamp),translate:interpolate(f,[.7*60,1.2*60],['20px 0px','0px 0px'],clamp)}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9}}><span style={{fontSize:18,color:colors.muted}}>STRUCTURED SUPPLIER RECORD</span><span style={{fontSize:18,color:colors.blue}}>sup_007</span></div>
      <h3 style={{fontSize:33,letterSpacing:-.8,fontWeight:650,margin:'0 0 24px'}}>{supplier.name}</h3>
      {fields.map((field,i)=><div key={field.short} style={{height:52,display:'flex',alignItems:'center',borderTop:`1px solid ${colors.line}`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'#edf3ff',opacity:interpolate(f,[(field.at+1.2)*60,(field.at+1.6)*60,(field.at+2.3)*60],[0,.9,0],clamp)}}/>
        <span style={{position:'relative',width:172,fontSize:21,color:colors.muted}}>{field.short}</span>
        <span style={{position:'relative',fontSize:23,fontWeight:550,color:field.color===colors.red?colors.red:colors.ink,opacity:interpolate(f,[(field.at+1.2)*60,(field.at+1.65)*60],[0,1],clamp),translate:interpolate(f,[(field.at+1.2)*60,(field.at+1.65)*60],['15px 0px','0px 0px'],clamp)}}>{i===3?'2 linked downstream suppliers':field.value}</span>
        <span style={{position:'relative',marginLeft:'auto',fontSize:20,color:colors.blue,opacity:interpolate(f,[(field.at+1.45)*60,(field.at+1.75)*60],[0,1],clamp)}}>✓</span>
      </div>)}
      <div style={{marginTop:17,padding:'13px 17px',borderRadius:7,background:'#fff3d9',border:'1px solid #edce8f',display:'flex',alignItems:'center',gap:13,opacity:single,scale:interpolate(f,[6.75*60,7.1*60,7.5*60],[.97,1.018,1],clamp)}}><strong style={{fontSize:22,color:colors.amber}}>Single source</strong><span style={{fontSize:20,color:'#7f6743'}}>No recorded alternative</span><span style={{marginLeft:'auto',color:colors.amber,fontSize:22}}>!</span></div>
    </Interactive.Div>
    <div style={{position:'absolute',left:86,right:88,top:758,height:44,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:20,color:colors.muted,opacity:interpolate(f,[6*60,6.5*60],[0,1],clamp)}}><span>Project seed records · traceable to the source</span><div style={{display:'flex',alignItems:'center',gap:22}}><span>10 supplier records</span><span style={{height:22,width:1,background:colors.line}}/><strong style={{color:colors.amber,fontSize:21,fontWeight:600,opacity:single}}>5 single-source suppliers</strong></div></div>
    <Caption text="10 suppliers · 5 single-source · project seed records"/>
  </Shell>;
};
