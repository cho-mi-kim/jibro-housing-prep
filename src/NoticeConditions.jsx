import React,{useEffect,useState,useId} from 'react';
import {ExternalLink,RefreshCw,ChevronDown} from 'lucide-react';
import {conditionItems} from './data';
import {isFamilyNotice,conditionItemsForNotice,conditionRowsForNotice} from './conditionProfile.mjs';
import {plainConditionSummary} from './conditionSummary.mjs';
import {familyConditionGuide} from './familyGuide.mjs';
import readableGuides from './readableGuides.json';
import {readableConditions,matchingReadableGuide} from './readableConditions.mjs';
import incomeGuides from './incomeGuides.json';
import {matchingIncomeGuide,moneyInWon,assetInWon} from './incomeGuide.mjs';
import {evidenceNoticeKey,validEvidenceSummary,evidenceSourceLink,evidenceLocation,createEvidenceLoader} from './noticeEvidence.mjs';

const evidenceApi=import.meta.env.VITE_NOTICE_EVIDENCE_API_BASE||import.meta.env.VITE_API_BASE;
const snapshots=createEvidenceLoader();

export function NoticeConditions({notice,checkedIds=[],heading}){
 const infoId=useId(),[expandedFor,setExpandedFor]=useState(null);
 const key=evidenceNoticeKey(notice?.url),[attempt,setAttempt]=useState(0),[result,setResult]=useState({key:null,status:'loading',data:null});
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  setResult({key,status:'loading',data:null});
  if(!key){setResult({key,status:'unsupported',data:null});return ()=>controller.abort();}
  (async()=>{
   let bundle=null,snapshotFailed=false;
   try{bundle=await snapshots({force:attempt>0})}catch{snapshotFailed=true}
   const stored=bundle?.summaries?.[key];
   let data=validEvidenceSummary(stored,key)?stored:null;
   if(cancelled)return;
   if(data)setResult({key,status:evidenceApi?'refreshing':'snapshot',data});
   if(!evidenceApi){setResult({key,status:data?'snapshot':snapshotFailed?'snapshot_error':'offline',data});return;}
   const timer=setTimeout(()=>controller.abort(),120000);
   try{
    const r=await fetch(evidenceApi.replace(/\/$/,'')+'/api/notice-evidence?url='+encodeURIComponent(key),{signal:controller.signal});
    if(!r.ok)throw Error(r.status===429?'busy':'error');
    const next=await r.json();if(!validEvidenceSummary(next,key))throw Error('mismatch');
    if(!cancelled)setResult({key,status:'live',data:next});
   }catch(error){if(!cancelled)setResult({key,status:data?'stale':error.message==='busy'?'busy':'error',data});}
   finally{clearTimeout(timer)}
  })();
  return ()=>{cancelled=true;controller.abort()};
 },[key,attempt]);
 const current=result.key===key?result:{status:'loading',data:null},data=current.data;
 const checkedAt=data?new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(data.checkedAt)):null;
 const messages={snapshot_error:'발췌 자료를 불러오지 못했어요. 연결을 확인한 뒤 다시 불러와주세요.',loading:'첨부 공고문을 확인하고 있어요.',refreshing:'저장된 발췌를 표시하며 최신 공고문을 확인 중이에요.',snapshot:'저장된 공고문 발췌예요. 이후 정정 여부는 공식 공고에서 확인해주세요.',stale:'최신 확인에 실패해 마지막으로 읽은 공고문 발췌를 표시해요.',offline:'이 공고의 공고문 발췌가 아직 준비되지 않았어요.',unsupported:'이 공고는 자동 분석 지원 대상이 아니에요. 첨부 원문을 확인해주세요.',error:'첨부 공고문을 불러오지 못했어요. 원문에서 확인해주세요.',busy:'다른 공고문을 확인 중이에요. 잠시 후 다시 시도해주세요.',live:'공식 첨부 공고문에서 관련 문구를 발췌했어요.'};
 const readable=conditionRowsForNotice(notice,matchingReadableGuide(data,readableGuides)||readableConditions(data?.criteria.flatMap(c=>c.evidence||[])||[],notice?.title));
 const displayItems=conditionItemsForNotice(notice,conditionItems),familyNotice=isFamilyNotice(notice);
 const infoOpen=!!key&&expandedFor===key,incomeGuide=matchingIncomeGuide(data,incomeGuides);
 return <div className="notice-evidence" aria-busy={current.status==='loading'||current.status==='refreshing'}>
  <div className="evidence-toolbar">{heading}{data&&<button type="button" className="evidence-info-toggle" aria-expanded={infoOpen} aria-controls={infoId} aria-label={`발췌 안내 ${infoOpen?'접기':'펼치기'}`} onClick={()=>setExpandedFor(infoOpen?null:key)}>발췌 안내<ChevronDown size={16} aria-hidden="true"/></button>}</div>
  {(!data||data.status==='unavailable'||!['snapshot','live'].includes(current.status))&&<p className="evidence-status" role="status">{data?.status==='unavailable'?'첨부 공고문에서 읽을 수 있는 조건 근거를 찾지 못했어요. 원문을 확인해주세요.':messages[current.status]}</p>}
  {data&&<div id={infoId} className="evidence-info" hidden={!infoOpen}>
   <p className="evidence-status">{messages[current.status==='live'?'live':'snapshot']}{checkedAt&&<span>확인 시각 {checkedAt}</span>}</p>
   {data.status==='partial'&&<p className="evidence-caution">공급대상별 기준과 예외가 함께 포함된 <strong>원문 일부 발췌</strong>입니다. 해당 대상의 전체 조건은 근거 원문에서 확인해주세요.</p>}
  </div>}
  {data&&<p className="condition-overview-note">대상별 기준과 예외는 아래 원문에서 확인할 수 있어요.</p>}
  <div className="evidence-criteria">{displayItems.map(c=>{
   const criterion=data?.criteria.find(item=>item.id===(c.id==='eligibility'?'family':c.id)),rows=readable?.[c.id]||[],combined=[...rows.map(r=>r.evidence),...(criterion?.evidence||[]),...(c.id==='eligibility'?(data?.criteria.find(item=>item.id==='age')?.evidence||[]):[])],items=combined.filter((e,i)=>typeof e.quote==='string'&&evidenceSourceLink(e.sourceUrl,e.page)&&combined.findIndex(x=>x.sourceId===e.sourceId&&x.page===e.page&&x.quote===e.quote)===i),read=checkedIds.includes(c.id),brief=c.id==='eligibility'?'혼인 기간·출산 또는 입양 기준은 공고 원문에서 확인해주세요.':c.id==='family'&&familyNotice?'다른 신청 대상과 가구원 범위는 공고 원문에서 확인해주세요.':plainConditionSummary(c.id,items,notice?.title),guide=c.id==='income'?incomeGuide:null,family=rows.length?{rows,note:c.id==='income'?'공고에서 확인된 기본 한도예요. 적용 대상·가산·예외는 원문을 확인하세요.':c.id==='family'&&rows.every(r=>['함께 확인할 사람','따로 사는 배우자'].includes(r.label))?'배우자가 있는 경우 함께 확인해요. 부모·자녀 등 나머지 가구원 범위는 원문을 확인하세요.':'공고에서 확인된 핵심 기준이에요. 다른 대상과 예외는 원문을 확인하세요.'}:c.id==='family'&&!familyNotice?familyConditionGuide(items,notice?.title):null;
   return <article className="evidence-criterion" key={c.id}>
    <div className="evidence-heading"><h3>{c.id==='income'?'소득·자산 기준':c.title}</h3><span className={'evidence-read-state '+(read?'is-read':'')}>{read?'내가 확인함':'아직 확인 안 함'}</span></div>
    {items.length?<>{guide?<div className="income-guide"><p className="income-guide-title">가구원 수별 월소득 한도</p><p className="income-guide-meta">세전 · 가구 합산 · 아래 금액 이하</p><dl className="income-households">{guide.rows.map(row=><div key={row.people}><dt>{row.people}인 가구</dt><dd>{moneyInWon(row.monthlyWon)}</dd></div>)}</dl><dl className="income-assets"><div><dt>총자산</dt><dd>{assetInWon(guide.totalAssetsWon)} 이하</dd></div><div><dt>자동차</dt><dd>{assetInWon(guide.carWon)} 이하</dd></div></dl><p className="income-guide-meta">기본 기준 · 1·2인 가구 가산 포함<br/>출산자녀 추가 가산은 원문에서 확인</p></div>:family?.rows.length?<div className="family-guide"><dl>{family.rows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.text}</dd></div>)}</dl><p className="income-guide-meta">{family.note}</p></div>:<><p className="condition-plain-summary">{brief}</p>{c.id==='income'&&<p className="income-guide-meta">1~4인 금액은 원문 확인이 필요해요.</p>}</>}<details key={key+':'+c.id} className="condition-original"><summary>자세한 조건·원문 보기<ChevronDown size={16} aria-hidden="true"/></summary>{guide&&<div className="evidence-quote"><p className="condition-original-label">금액표 근거 · 1인 90%, 2인 80%, 3·4인 70%</p><blockquote>{guide.quote}</blockquote><a href={evidenceSourceLink(guide.sourceUrl,guide.page)} target="_blank" rel="noreferrer">{guide.sourceName} · {evidenceLocation(guide)}<ExternalLink size={14} aria-hidden="true"/></a></div>}{items.map((e,i)=><div className="evidence-quote" key={e.sourceId+':'+e.page+':'+i}><p className="condition-original-label">원문 {i+1}</p><blockquote>{e.quote}</blockquote><a href={evidenceSourceLink(e.sourceUrl,e.page)} target="_blank" rel="noreferrer">{e.sourceName} · {evidenceLocation(e)}<ExternalLink size={14} aria-hidden="true"/></a></div>)}</details></>:<p className="evidence-missing">{current.status==='loading'?'공고문 확인 중…':['snapshot_error','error'].includes(current.status)?'자료를 불러온 뒤 조건 근거를 확인할 수 있어요.':'원문 확인 필요 · 확인된 근거가 아직 없어요.'}</p>}
   </article>
  })}</div>
  {!!data?.warnings?.length&&<details className="evidence-warnings"><summary>분석하지 못한 내용 확인</summary><ul>{data.warnings.map((text,i)=><li key={i}>{text}</li>)}</ul></details>}
  {key&&<button className="evidence-retry" disabled={['loading','refreshing'].includes(current.status)} onClick={()=>setAttempt(n=>n+1)}><RefreshCw size={15} aria-hidden="true"/>{evidenceApi?'공고문 다시 확인':'발췌 자료 다시 불러오기'}</button>}
 </div>
}
