import React from 'react';
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import verified from './data/verified.json';
import {Narration, useSpokenCaption} from './Narration';
export const data = verified;
export const colors = {bg:'#f5f7fa',paper:'#ffffff',ink:'#203047',muted:'#596779',line:'#dce3ed',blue:'#285bd0',green:'#287348',amber:'#996411',red:'#b33b34'};
export const ease = Easing.bezier(.16,1,.3,1);
export const clamp = {extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease} as const;
export const font = '"Avenir Next", "Segoe UI", sans-serif';
export type Supplier = typeof data.suppliers[number];

export const Mark:React.FC = () => <div style={{display:'flex',alignItems:'center',gap:5}}>{[28,18,33].map((h,i)=><span key={i} style={{display:'block',width:7,height:h,background:i===1?colors.blue:colors.ink,transform:'skewY(-24deg)',borderRadius:1}}/>)}</div>;
export const Check:React.FC<{color?:string,size?:number}> = ({color=colors.green,size=22}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>;
export const Arrow:React.FC = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>;

export const Shell:React.FC<React.PropsWithChildren<{time:number}>> = ({children,time}) => <Narration time={time}><AbsoluteFill style={{background:colors.bg,color:colors.ink,fontFamily:font}}>
  <div style={{height:92,background:'white',borderBottom:`1px solid ${colors.line}`,display:'flex',alignItems:'center',padding:'0 64px',gap:18}}><Mark/><span style={{fontSize:32,fontWeight:700,letterSpacing:-1}}>Markov</span><span style={{marginLeft:14,paddingLeft:30,borderLeft:`1px solid ${colors.line}`,fontSize:22,color:colors.muted}}>Operations workspace</span><div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:18}}><span style={{fontSize:20,color:colors.muted}}>Prototype replay</span><span style={{display:'flex',alignItems:'center',gap:12,border:`1px solid ${colors.line}`,borderRadius:9,padding:'12px 16px',fontSize:20,fontWeight:600}}>Demo mode<span style={{width:44,height:25,borderRadius:14,background:colors.blue,padding:4,display:'flex',justifyContent:'flex-end'}}><span style={{height:17,width:17,borderRadius:10,background:'white'}}/></span></span></div></div>
  {children}<Pipeline seconds={time}/>
</AbsoluteFill></Narration>;

export const Heading:React.FC<{title:string;sub:string}> = ({title,sub})=>{const f=useCurrentFrame();return <div style={{position:'absolute',top:128,left:80,right:80,opacity:interpolate(f,[0,26],[0,1],clamp),translate:interpolate(f,[0,34],['0px 18px','0px 0px'],clamp)}}><Interactive.H1 name="Scene headline" style={{fontSize:44,lineHeight:1.2,letterSpacing:-1.2,margin:0,fontWeight:650}}>{title}</Interactive.H1><p style={{fontSize:24,lineHeight:1.5,color:colors.muted,margin:'10px 0 0'}}>{sub}</p></div>};

export const Caption:React.FC<{text:string;from?:number;until?:number}> = ({text,from=0,until=9999}) => {const f=useCurrentFrame();const spoken=useSpokenCaption();if(spoken)return null;return <Interactive.Div name="Fact caption" style={{position:'absolute',left:80,bottom:176,display:'inline-flex',padding:'15px 22px',borderRadius:8,fontSize:24,lineHeight:1.3,background:'#203047',color:'#fff',maxWidth:1760,opacity:interpolate(f,[from*60,from*60+14,until*60,until*60+14],[0,1,1,0],clamp)}}>{text}</Interactive.Div>};

export const Pipeline:React.FC<{seconds:number}> = ({seconds})=>{
 const phase=[{index:0,start:12,end:30},{index:1,start:30,end:55},{index:4,start:55,end:77},{index:1,start:77,end:78.6},{index:2,start:78.6,end:81.43},{index:3,start:81.43,end:88.2},{index:1,start:88.2,end:91.5},{index:2,start:91.5,end:94.1},{index:3,start:94.1,end:98}].find(p=>seconds>=p.start&&seconds<p.end);
 const stages=[{title:'Supplier records',sub:'Local seed records',at:12,end:30},{title:'Propagation',sub:'Deterministic analysis',at:30,end:55},{title:'Response wording',sub:'Template fallback',at:77,end:84},{title:'Human approval',sub:'Draft remains unsent',at:84,end:98},{title:'Activity log',sub:'Standalone monitor',at:55,end:77}];
 return <div style={{position:'absolute',left:64,right:64,bottom:30,height:123,background:'#151922',borderRadius:12,padding:'20px 26px',display:'flex',alignItems:'center',gap:18}}><div style={{width:172,color:'#b3bdd0',fontSize:20,lineHeight:1.5}}>Processing path<br/><span style={{fontSize:18,color:'#a7b4ca'}}>Prototype architecture</span></div>{stages.map((s,i)=>{const done=seconds>=s.end;const active=phase?.index===i;const pending=i===3;const progress=interpolate(seconds,active&&phase?[phase.start,phase.end]:[s.at,s.end],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <React.Fragment key={s.title}><div style={{flex:1,height:82,borderRadius:8,padding:'13px 16px',position:'relative',overflow:'hidden',background:active?'#314f7d':done&&!pending?'#263d62':'#242a36',border:active?'1px solid #91b8ff':pending&&done?'1px solid #b98b3c':'1px solid transparent',boxShadow:active?'0 0 0 3px #739df517':'none',color:'#eceef4'}}><strong style={{fontSize:22,fontWeight:600,display:'block'}}>{s.title}</strong><span style={{fontSize:18,color:pending&&(done||active)?'#f5c875':'#b6c4db',display:'block',marginTop:5}}>{s.sub}</span><div style={{position:'absolute',bottom:0,left:0,height:3,width:`${progress*100}%`,background:pending?'#d7a449':'#8cb5ff'}}/></div>{i<4&&<span style={{color:active?'#b7d0ff':'#7d8ba5',translate:active?`${Math.sin(seconds*2)*2}px 0px`:'0px 0px'}}><Arrow/></span>}</React.Fragment>})}</div>;
};

export const SupplierCard:React.FC<{supplier:Supplier;reveal?:number;status?:boolean;single?:boolean;compact?:boolean;hit?:'direct'|'cascade'}>=({supplier,reveal=1,status=true,single=true,compact=false,hit})=> {
 const color=hit==='direct'?colors.red:hit==='cascade'?colors.amber:colors.ink;
 return <div data-supplier={supplier.id} style={{background:hit==='direct'?'#fff2ef':hit==='cascade'?'#fff8ea':'white',border:`${hit?2:1}px solid ${hit==='direct'?'#d9887d':hit==='cascade'?'#dfc38f':colors.line}`,borderRadius:10,padding:compact?'21px 23px':'22px',height:'100%',opacity:reveal,position:'relative'}}>
  {!compact&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:18,marginBottom:17,color:colors.muted}}><span>{supplier.id}</span><span style={{display:'flex',alignItems:'center',gap:7,opacity:status?1:0,color:supplier.compliance_status==='compliant'?colors.green:supplier.compliance_status==='at_risk'?colors.amber:colors.red}}><i style={{height:7,width:7,background:'currentColor',borderRadius:'50%'}}/>{supplier.compliance_status==='compliant'?'Compliant':supplier.compliance_status==='at_risk'?'At risk':'Non-compliant'}</span></div>}
  <h3 style={{fontSize:compact?25:24,fontWeight:650,letterSpacing:-.5,lineHeight:1.3,margin:0,color}}>{supplier.name}</h3><p style={{fontSize:compact?21:20,lineHeight:1.45,margin:'9px 0',color:colors.muted}}>{supplier.part_supplied}</p>
  <div style={{position:'absolute',bottom:19,left:22,right:22,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,fontSize:18}}>{supplier.single_source&&single?<span style={{color:'#865b12',background:'#fff0ce',padding:'4px 9px',borderRadius:4}}>Single source</span>:<span style={{color:colors.muted}}>{compact? 'Downstream exposure':supplier.location}</span>}{hit&&<span style={{fontSize:18,color}}>{hit==='direct'?'Direct':'Exposed'}</span>}</div>
 </div>;
};

export const NetworkBoard:React.FC<{assemble?:boolean;resolve?:boolean}> = ({assemble=false,resolve=true})=>{
 const frame=useCurrentFrame();
 return <div style={{position:'absolute',left:80,right:80,top:260,display:'grid',gridTemplateColumns:'repeat(5,1fr)',gridTemplateRows:'242px 242px',gap:20}}>{data.suppliers.map((s,i)=><SupplierCard key={s.id} supplier={s} status={resolve} single={resolve} reveal={assemble?interpolate(frame,[i*2.4,i*2.4+14],[.03,1],clamp):1}/>)}</div>;
};

const positions:Record<string,{x:number;y:number}>={sup_007:{x:90,y:445},sup_005:{x:550,y:305},sup_008:{x:550,y:575},sup_002:{x:1010,y:305},sup_006:{x:1010,y:575},sup_004:{x:1470,y:445}};
export const CascadeGraph:React.FC<{reveals:number[];riskAt:number;showRisk?:boolean;showReceipt?:boolean}>=({reveals,riskAt,showRisk=true,showReceipt=true})=>{
 const frame=useCurrentFrame();
 const ids=['sup_007','sup_005','sup_008','sup_002','sup_006','sup_004'];
 const hop=data.risk.hop_depth as Record<string,number>;
 const edges=ids.flatMap(id=>data.suppliers.find(s=>s.id===id)!.downstream_dependents.filter(d=>ids.includes(d)).map(d=>[id,d]));
 const complete=frame>=(reveals[3]+1.1)*60;
 const activeHop=complete?-1:reveals.reduce((latest,at,i)=>frame>=at*60?i:latest,-1);
 const arrived=ids.filter(id=>frame>=reveals[hop[id]]*60).length;
 const riskReady=frame>=riskAt*60;
 const linear={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
 return <>
  {activeHop>=0&&<div style={{position:'absolute',left:[78,538,998,1458][activeHop],top:295,width:364,height:480,borderRadius:18,background:'linear-gradient(180deg,#e8effa80,#edf2f800)',opacity:interpolate(frame,[reveals[activeHop]*60,reveals[activeHop]*60+20],[0,1],clamp)}}/>}
  <svg width={1920} height={1080} style={{position:'absolute',inset:0}}>
   {edges.map(([a,b])=>{
    const start=positions[a],end=positions[b];
    const at=reveals[hop[b]]*60;
    const progress=interpolate(frame,[at-44,at],[0,1],linear);
    const d=`M ${start.x+340} ${start.y+94} C ${start.x+405} ${start.y+94}, ${end.x-65} ${end.y+94}, ${end.x} ${end.y+94}`;
    const t=progress,u=1-t;
    const x=u*u*u*(start.x+340)+3*u*u*t*(start.x+405)+3*u*t*t*(end.x-65)+t*t*t*end.x;
    const y=u*u*u*(start.y+94)+3*u*u*t*(start.y+94)+3*u*t*t*(end.y+94)+t*t*t*(end.y+94);
    return <g key={`${a}-${b}`}>
     <path d={d} fill="none" stroke={colors.line} strokeWidth={2} strokeDasharray="5 7" opacity={.7}/>
     <path d={d} fill="none" stroke={colors.amber} strokeWidth={3} pathLength={1} strokeDasharray="1" strokeDashoffset={1-progress} opacity={progress>0?1:0}/>
     {frame>=at-44&&frame<at+8&&<><circle cx={x} cy={y} r={13} fill="#d39b35" opacity={.16}/><circle cx={x} cy={y} r={6} fill="#bd7e10"/><circle cx={x} cy={y} r={2.5} fill="white"/></>}
    </g>;
   })}
   {reveals[0]>0&&frame>=reveals[0]*60-52&&frame<reveals[0]*60&&<><path d="M260 272V438" stroke={colors.red} strokeWidth={2} strokeDasharray="4 7" opacity={.5}/><circle cx={260} cy={interpolate(frame,[reveals[0]*60-52,reveals[0]*60],[275,440],linear)} r={7} fill={colors.red}/></>}
  </svg>
  {ids.map(id=>{
   const s=data.suppliers.find(s=>s.id===id)!,h=hop[id],at=reveals[h]*60;
   const hit=frame>=at,focus=activeHop===h;
   const settling=interpolate(frame,[at,at+20,at+50],[0,-3,0],clamp);
   const ring=interpolate(frame,[at,at+64],[0,1],linear);
   return <div key={id} style={{position:'absolute',left:positions[id].x,top:positions[id].y,width:340,height:188,translate:`0px ${settling}px`,opacity:hit?1:interpolate(frame,[at-44,at],[.3,.7],clamp)}}>
    {hit&&ring<1&&<div style={{position:'absolute',inset:2-ring*5,border:`2px solid ${h===0?'#bc4338':'#ba882c'}`,borderRadius:12,opacity:(1-ring)*.75}}/>}
    <div style={{height:'100%',borderRadius:10,boxShadow:focus?'0 12px 30px #20304722':'0 2px 4px #20304706'}}><SupplierCard supplier={s} compact hit={hit?h===0?'direct':'cascade':undefined}/></div>
    {focus&&<div style={{position:'absolute',left:16,right:16,bottom:-2,height:4,borderRadius:3,background:h===0?colors.red:colors.amber,scale:interpolate(frame,[at,at+36],[0,1],clamp),transformOrigin:'left'}}/>}
   </div>;
  })}
  {['Direct supplier','Tier 1','Tier 2','Finished product'].map((label,i)=><span key={label} style={{position:'absolute',top:274,left:[90,550,1010,1470][i],fontSize:20,color:activeHop===i?colors.blue:colors.muted,fontWeight:activeHop===i?650:400}}>{label}{activeHop===i?'  •':''}</span>)}
  {showRisk&&<div style={{position:'absolute',right:80,top:126,display:'flex',alignItems:'baseline',gap:16}}><span style={{fontSize:22,color:colors.muted}}>Network risk</span><strong style={{fontSize:riskReady?48:27,fontWeight:650,color:riskReady?colors.red:colors.muted,fontVariantNumeric:'tabular-nums',minWidth:135,textAlign:'right'}}>{riskReady?interpolate(frame,[riskAt*60,riskAt*60+66],[0,data.risk.network_risk_score],clamp).toFixed(3):'Tracing…'}</strong></div>}
  {showReceipt&&riskAt>0&&<div style={{position:'absolute',left:90,top:786,display:'flex',alignItems:'center',gap:12,fontSize:20,color:complete?colors.green:colors.muted,opacity:interpolate(frame,[reveals[0]*60,reveals[0]*60+20],[0,1],clamp)}}><span style={{width:7,height:7,borderRadius:5,background:'currentColor'}}/>{complete?`${arrived} affected suppliers · dependency trace complete`:`${arrived} affected supplier${arrived===1?'':'s'} identified`}</div>}
 </>;
};
