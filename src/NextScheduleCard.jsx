import React,{useEffect,useState} from 'react';
import {CalendarDays,ChevronRight} from 'lucide-react';
import {evidenceNoticeKey} from './noticeEvidence.mjs';
import {loadSchedules,matchingSchedule} from './noticeSchedules.mjs';
import {nextSchedule} from './nextSchedule.mjs';
import './nextScheduleCard.css';

export function NextScheduleCard({notice,onOpen}){
 const [bundle,setBundle]=useState(null),key=evidenceNoticeKey(notice?.url);
 useEffect(()=>{let active=true;loadSchedules().then(data=>{if(active)setBundle(data)}).catch(()=>{});return()=>{active=false}},[key]);
 const event=nextSchedule(notice,matchingSchedule(notice,bundle));
 const date=event?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric'}).format(new Date(event.date+'T12:00:00+09:00')):null;
 return <button type="button" className="home-next-schedule" onClick={onOpen} aria-label={event?`다음 일정: ${event.date}, ${event.title}${event.hasVariants?', 단지·순위별 일정 확인':''}. 일정 관리 보기`:'다음 일정 확인 필요. 일정 관리 보기'}>
  <span className="home-next-schedule-icon" aria-hidden="true"><CalendarDays size={19}/></span>
  <span className="home-next-schedule-copy"><span className="home-next-schedule-label">다음 일정</span>
   {event?<><time dateTime={event.date}>{date}{event.today&&<small>오늘</small>}</time><span className="home-next-schedule-event">{event.title}</span>{event.hasVariants&&<span className="home-next-schedule-scope">단지·순위별 확인</span>}</>:<><strong>일정 확인 필요</strong><span className="home-next-schedule-event">공고 일정 확인하기</span></>}
  </span>
  <ChevronRight className="home-next-schedule-arrow" size={15} aria-hidden="true"/>
 </button>;
}
