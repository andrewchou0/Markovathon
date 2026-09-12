import React from 'react';
import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import {Caption, Heading, Shell, clamp, colors, data} from '../ui';

const chain = [
  {id:'sup_007', label:'Upstream input', reveal:.72, focus:5.49},
  {id:'sup_005', label:'Component', reveal:.5, focus:6.03},
  {id:'sup_002', label:'Direct dependency', reveal:.28, focus:6.57},
  {id:'sup_004', label:'Finished product', reveal:.06, focus:7.11},
];

export const Problem:React.FC = () => {
  const f=useCurrentFrame();
  return <Shell time={f/60}>
    <Heading title="Supply chain overview" sub="The disruption you need to see may be three tiers away."/>
    <div style={{position:'absolute',left:80,right:80,top:264,height:74,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:15}}><strong style={{fontSize:46,letterSpacing:-1.5,fontWeight:650,color:colors.blue}}>03</strong><span style={{fontSize:25,color:colors.muted}}>tiers between an input and production</span></div>
      <span style={{fontSize:20,color:colors.muted,padding:'12px 18px',borderRadius:7,border:`1px solid ${colors.line}`,background:'white'}}>One recorded dependency path</span>
    </div>
    <div style={{position:'absolute',left:80,top:363,width:1760,height:294,borderRadius:16,background:'#edf2f8',opacity:interpolate(f,[.22*60,.52*60],[0,1],clamp)}}/>
    <svg width={1920} height={1080} style={{position:'absolute',inset:0}}>
      {[0,1,2].map(i=>{
        const at=chain[i].reveal*60; const start=475+i*455; const end=start+60;
        const p=interpolate(f,[(chain[i].focus+.18)*60,chain[i+1].focus*60],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
        const trace=interpolate(f,[(1.15+(2-i)*.32)*60,(1.4+(2-i)*.32)*60],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
        return <g key={i} opacity={interpolate(f,[at,at+12],[0,1],clamp)}>
          <path d={`M ${start} 513 H ${end}`} stroke={colors.line} strokeWidth={3}/>
          <path d={`M ${end-8} 508 L ${end} 513 L ${end-8} 518`} fill="none" stroke={colors.muted} strokeWidth={2}/>
          <path d={`M ${end} 513 H ${start}`} pathLength={1} strokeDasharray="1" strokeDashoffset={1-trace} stroke="#819fce" strokeWidth={3}/>
          {trace>0&&trace<1&&<circle cx={end-(end-start)*trace} cy={513} r={5} fill={colors.blue}/>}
          <path d={`M ${start} 513 H ${end}`} pathLength={1} strokeDasharray="1" strokeDashoffset={1-p} stroke={colors.amber} strokeWidth={4}/>
          {p>0&&p<1&&<><circle cx={start+(end-start)*p} cy={513} r={13} fill="#e8b153" opacity={.18}/><circle cx={start+(end-start)*p} cy={513} r={5} fill={colors.amber}/></>}
        </g>;
      })}
    </svg>
    {chain.map((node,i)=>{
      const s=data.suppliers.find(item=>item.id===node.id)!; const active=f>=node.focus*60;
      const arrival=interpolate(f,[node.focus*60,node.focus*60+8,node.focus*60+36],[0,1,0],clamp);
      return <Interactive.Div key={s.id} name={`Dependency · ${s.name}`} style={{position:'absolute',left:80+i*455,top:386,width:395,height:251,opacity:interpolate(f,[node.reveal*60,node.reveal*60+15],[0,1],clamp),translate:interpolate(f,[node.reveal*60,node.reveal*60+18],['0px 14px','0px 0px'],clamp),scale:interpolate(f,[node.focus*60,node.focus*60+10,node.focus*60+28],[1,1.025,1],clamp),borderRadius:11,border:`1.5px solid ${active?'#d8ae64':colors.line}`,background:active?'#fffaf0':'#fff',boxShadow:active?`0 0 0 ${arrival*10}px #e9b85722, 0 12px 30px #20304708`:'0 8px 24px #20304705',padding:25}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',color:active?colors.amber:colors.muted,fontSize:19,fontWeight:600}}><span>{node.label}</span><span style={{fontSize:17,fontVariantNumeric:'tabular-nums',opacity:.7}}>0{i+1}</span></div>
        <h3 style={{fontSize:29,letterSpacing:-.6,lineHeight:1.18,margin:'25px 0 12px',fontWeight:650}}>{s.name}</h3>
        <div style={{fontSize:22,lineHeight:1.4,color:colors.muted,maxWidth:340}}>{s.part_supplied}</div>
        <div style={{position:'absolute',bottom:19,left:25,right:25,display:'flex',alignItems:'center',gap:9,fontSize:18,color:active?colors.amber:colors.muted}}><span style={{width:7,height:7,borderRadius:5,background:active?colors.amber:'#9bb5d8'}}/>{active?(i===0?'One missing input':i===3?'Production exposure':'Dependency exposure'):s.location}</div>
      </Interactive.Div>;
    })}
    <div style={{position:'absolute',left:80,top:681,width:1760,height:104,display:'flex',alignItems:'center',gap:28,opacity:interpolate(f,[5.49*60,5.74*60],[0,1],clamp)}}>
      <div style={{width:60,height:60,borderRadius:30,background:'#fff0d1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,color:colors.amber,fontWeight:600}}>!</div>
      <div style={{flex:1}}><div style={{fontSize:30,fontWeight:600,letterSpacing:-.5}}>One missing input. A connected chain.</div><div style={{fontSize:22,color:colors.muted,marginTop:7}}>Exposure travels through the dependencies your records already describe.</div></div>
      <div style={{fontSize:22,fontWeight:600,color:colors.blue,display:'flex',alignItems:'center',gap:15,opacity:interpolate(f,[9.465*60,9.765*60],[0,1],clamp),translate:interpolate(f,[9.465*60,9.765*60],['20px 0px','0px 0px'],clamp)}}><span style={{width:34,height:34,borderRadius:20,background:'#e5edff',display:'flex',alignItems:'center',justifyContent:'center'}}>✓</span>Make the exposure visible</div>
    </div>
    <Caption text="Supplier dependency path · prototype replay" from={.5}/>
  </Shell>;
};
