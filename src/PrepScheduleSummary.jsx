import React,{useEffect,useState} from 'react';
import {CalendarDays,ChevronRight} from 'lucide-react';
import {evidenceNoticeKey} from './noticeEvidence.mjs';
import {loadSchedules,matchingSchedule} from './noticeSchedules.mjs';
import {scheduleStages} from './scheduleTimeline.mjs';
import './prepScheduleSummary.css';

export function PrepScheduleSummary({notice,onOpen}){
 const [bundle,setBundle]=useState(null),[loaded,setLoaded]=useState(false),key=evidenceNoticeKey(notice?.url);
 useEffect(()=>{let active=true;setLoaded(false);loadSchedules(key).then(data=>{if(active)setBundle(data)}).catch(()=>{}).finally(()=>{if(active)setLoaded(true)});return()=>{active=false}},[key]);
 const source=matchingSchedule(notice,bundle),variant=source?.variants[0];
 // Use one declared schedule, never combine different buildings/ranks into a sequence.
 const upcoming=scheduleStages(variant?variant.dates:notice).filter(e=>e.id!=='posted'&&e.diff!==null&&e.diff>=0).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
 const formatDate=value=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'}).format(new Date(value+'T12:00:00+09:00'));
 return <button type="button" className="prep-schedule-summary" onClick={onOpen}>
  <span className="prep-schedule-heading"><span><CalendarDays size={18} aria-hidden="true"/>다가오는 주요 일정</span><span className="prep-schedule-open">일정 관리<ChevronRight size={16} aria-hidden="true"/></span></span>
  {upcoming.length?<span className="prep-schedule-rows">{upcoming.map((event,i)=><span key={event.id} className={`prep-schedule-row${i===0?' is-next':''}`}><time dateTime={event.date}>{formatDate(event.date)}</time><span>{event.title}{event.diff===0&&<small>오늘</small>}</span></span>)}</span>:<span className="prep-schedule-empty">{loaded?'확인된 예정 일정이 없어요. 전체 일정을 확인해주세요.':'일정을 확인하고 있어요.'}</span>}
  {source?.variants.length>1&&<span className="prep-schedule-scope">{variant.label} 기준 · 단지·순위별 일정은 전체 보기에서 확인</span>}
 </button>;
}
