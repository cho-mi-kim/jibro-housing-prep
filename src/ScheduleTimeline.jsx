import React,{useEffect,useState} from 'react';
import {Check,MapPin} from 'lucide-react';
import {scheduleStages} from './scheduleTimeline.mjs';
import './scheduleTimeline.css';
import {evidenceNoticeKey,evidenceSourceLink} from './noticeEvidence.mjs';
import {loadSchedules,matchingSchedule} from './noticeSchedules.mjs';

export function ScheduleTimeline({notice}){
 const key=evidenceNoticeKey(notice?.url),[loaded,setLoaded]=useState(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[selection,setSelection]=useState({key:null,index:0});
 useEffect(()=>{let cancelled=false;setFailed(false);loadSchedules(key,{force:attempt>0}).then(bundle=>{if(!cancelled)setLoaded(bundle)}).catch(()=>{if(!cancelled)setFailed(true)});return()=>{cancelled=true}},[key,attempt]);
 const source=matchingSchedule(notice,loaded),index=selection.key===key?selection.index:0,variant=source?.variants[index]||source?.variants[0];
 const stages=scheduleStages(variant?{posted:notice?.posted,...variant.dates}:notice);
 const checked=source?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(source.checkedAt)):null;
 return <section className="application-timeline" aria-labelledby="application-timeline-title">
  <div className="application-timeline-heading"><h2 id="application-timeline-title">전체 신청 일정</h2><span>날짜 기준</span></div>
  {source?.variants.length>1&&<label className="timeline-variant">단지·접수 유형별 일정<select value={index} onChange={e=>setSelection({key,index:Number(e.target.value)})}>{source.variants.map((v,i)=><option key={i} value={i}>{v.label}</option>)}</select></label>}
  {source?.variants.length>1&&<p className="timeline-scope">{variant.label}</p>}
  <ol>{stages.map(stage=>{
   const date=stage.date?new Date(stage.date+'T12:00:00+09:00'):null;
   const shortDate=date?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric'}).format(date):null;
   const weekday=date?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',weekday:'short'}).format(date):null;
   return <li role="listitem" key={stage.id} className={`timeline-stage is-${stage.status}`}>
    <span className="timeline-marker" aria-hidden="true">{stage.status==='past'?<Check size={13}/>:['current','today'].includes(stage.status)?<MapPin size={13}/>:null}</span>
    {date?<time dateTime={stage.date} aria-label={`${stage.date} ${weekday}요일`}><b>{shortDate}</b><small>({weekday}){variant?.dates?.[stage.id+'Time']&&<> · {variant.dates[stage.id+'Time']}</>}</small></time>:<span className="timeline-date-missing" aria-label="날짜 확인 필요">—</span>}
    <span className="timeline-stage-title">{stage.title}{['documentDeadline','winnerDocumentDeadline'].includes(stage.id)&&variant?.dates[stage.id==='documentDeadline'?'documentStart':'winnerDocumentStart']&&<small>제출 시작 {variant.dates[stage.id==='documentDeadline'?'documentStart':'winnerDocumentStart'].slice(5).replace('-', '.')}</small>}</span>
    <span className={`timeline-badge${stage.diff!==null&&stage.diff>=0&&stage.diff<=7&&['deadline','documentDeadline','winnerDocumentDeadline'].includes(stage.id)?' is-near':''}`}>{stage.badge}</span>
   </li>;
  })}</ol>
  {checked&&<p className="timeline-checked">공식 페이지 확인 · {checked}</p>}
  {failed&&<p className="timeline-note" role="status">상세 일정을 불러오지 못했어요. 목록에서 확인한 날짜만 표시합니다.<button type="button" className="text-button" onClick={()=>setAttempt(n=>n+1)}>일정 다시 불러오기</button></p>}
  {source&&<details className="timeline-evidence"><summary>일정 근거·세부 접수 일정 보기</summary><a href={source.noticeUrl} target="_blank" rel="noreferrer">LH 상세 페이지의 공급일정 ↗</a><pre>{source.detailQuote}</pre>{source.excerpts.map((e,i)=><div key={i}><a href={evidenceSourceLink(e.sourceUrl,e.page)} target="_blank" rel="noreferrer">저장된 공고문 · {e.sourceName} · {e.page}쪽 ↗</a><pre>{e.quote}</pre></div>)}</details>}
  <p className="timeline-note">공고에 따라 일부 단계가 없거나 일정이 다를 수 있어요. 확인되지 않은 날짜와 마감 시각은 공고 원문에서 확인해주세요.</p>
 </section>;
}
