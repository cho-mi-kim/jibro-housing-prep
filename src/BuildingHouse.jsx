import React from 'react';
export function BuildingHouse({progress=0}) {
 const p=Math.min(100,Math.max(0,progress));
 const colors=['#b94429','#dc6744','#ed9871','#ca5031','#e78059'];
 const bricks=[];
 for(let row=0;row<7;row++){
  const offset=row%2? -14:0;
  for(let col=0;col<5;col++){
   const left=Math.max(30,30+offset+col*28),right=Math.min(142,56+offset+col*28);
   if(right<=left)continue;
   const threshold=10+(row*5+col)*1.9;
   bricks.push(<rect key={`${row}-${col}`} x={left} y={132-row*12} width={right-left} height="10" rx="1.5" fill={colors[(row*3+col)%5]} className="build-piece" style={{opacity:p>=threshold?1:0,transform:p>=threshold?'translateY(0)':'translateY(-7px)'}}/>);
  }
 }
 const materialPieces=Array.from({length:24},(_,i)=>{
  const column=i%4, row=Math.floor(i/4);
  const rowThresholds=[99,90,75,55,30,0];
  const threshold=Math.max(0,rowThresholds[row]-column*2);
  const x=column*10+(row%2?3:0), y=136-row*9;
  const tilt=(column%3-1)*2;
  return <g key={`material-${i}`} className="build-material" style={{opacity:p<=threshold?1:0,transform:p<=threshold?'translateY(0)':'translateY(-4px)'}}>
   <rect x={x} y={y} width="11" height="7.5" rx="1.2" fill={colors[(i+2)%colors.length]} transform={`rotate(${tilt} ${x+5.5} ${y+3.5})`}/>
   <path d={`M${x+3.5} ${y}v7.5M${x+7.5} ${y}v7.5`} stroke="#f8d5c4" strokeWidth=".9" opacity=".8"/>
  </g>
 });
 return <figure className="brick-building" role="img" aria-label={`준비도 ${p}%, ${p===0?'집을 지을 터':p<80?'벽돌을 쌓는 중':p<100?'지붕을 올리는 중':'벽돌집 완성'}`}>
 <svg viewBox="0 0 172 168" aria-hidden="true">
 <g className="build-material" style={{opacity:p<100?1:0}}><path d="M0 143h43v5H0z" fill="#9c806c"/><path d="M2 143h39" stroke="#f0d7c8" strokeWidth="1.5"/><path d="M2 139h39l-2-4H4z" fill="#d9baa5" opacity=".8"/></g>
 {materialPieces}
 <g transform="translate(18 0)">
 <ellipse cx="86" cy="148" rx="71" ry="9" fill="#efdfd5"/>
 <path d="M26 141H146V148H26Z" fill="#bda48f"/><path d="M26 141H146L139 136H33Z" fill="#e6d0bd"/>
 {bricks}
 <g className="build-outline" style={{opacity:p<85?.42:0}} aria-hidden="true"><path d="M25 59L86 14L148 59" fill="none" stroke="#d88a6d" strokeWidth="4" strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round"/><path d="M39 58L86 24L133 58" fill="none" stroke="#e5ad93" strokeWidth="2" strokeDasharray="5 5"/></g>
 <g className="build-piece" style={{opacity:p>=85?1:0,transform:p>=85?'translateY(0)':'translateY(-10px)'}}><path d="M126 52V25H139V62" fill="#c44d30"/><path d="M24 59L86 14L148 59" fill="none" stroke="#ab3e28" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/><path d="M39 57L86 24L133 57Z" fill="#ed9974"/></g>
 <g className="build-piece" style={{opacity:p>=100?1:0}}><rect x="78" y="105" width="23" height="37" rx="2" fill="#824932" stroke="#ffe6d4" strokeWidth="3"/><circle cx="95" cy="126" r="1.5" fill="#ffcf87"/><rect x="43" y="76" width="24" height="23" rx="2" fill="#f4c69d" stroke="#fff1df" strokeWidth="3"/><path d="M55 76V99M43 87H67" stroke="#fff1df" strokeWidth="2"/><rect x="109" y="76" width="24" height="23" rx="2" fill="#f4c69d" stroke="#fff1df" strokeWidth="3"/><path d="M121 76V99M109 87H133" stroke="#fff1df" strokeWidth="2"/></g>
 </g>
 </svg><figcaption>{p===0?'내 집의 터를 마련했어요':p<80?'벽돌을 차곡차곡 쌓는 중':p<100?'지붕을 올리고 있어요':'준비 완료, 집이 완성됐어요'}</figcaption></figure>
}
