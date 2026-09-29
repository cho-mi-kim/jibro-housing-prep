import {evidenceNoticeKey} from './noticeEvidence.mjs';
import {koreaToday} from './scheduleTimeline.mjs';
import {validNoticeDate} from './noticeFeed.mjs';
// Content revisions ignore refresh timestamps. No fuzzy replacement of notices.
export function catalogEntry(notice,catalog){
 const found=catalog?.items?.[notice?.id];
 return found&&found.key===evidenceNoticeKey(notice.url)&&found.notice.title===notice.title&&found.notice.posted===notice.posted&&found.notice.status===notice.status&&found.notice.deadline===(notice.listingDeadline||notice.deadline)?found:null;
}
export function cancelledNotice(n){const title=n?.title||'',prefix=title.match(/^(?:\s*(?:\[[^\]]+\]|\([^)]+\)))*/)?.[0]||'';return /취소/.test(n?.status||'')||/취소공고/.test(prefix)||/^\s*취소공고/.test(title)}
export function noticeRevision(notice,catalog){
 const e=catalogEntry(notice,catalog);
 return JSON.stringify([notice?.id,notice?.title,notice?.posted,notice?.status,notice?.listingDeadline||notice?.deadline,e?.revision||'unanalysed']);
}
export function recordReview(record={},notice,catalog){
 const e=catalogEntry(notice,catalog),versions=record.conditionVersions||{},docVersions=record.documentVersions||{};
 const conditions=(record.conditions||[]).filter(id=>!cancelledNotice(notice)&&!e?.stale?.conditions&&versions[id]===(e?.versions.conditions||noticeRevision(notice,catalog)));
 const done=(record.done||[]).filter(id=>!cancelledNotice(notice)&&!e?.stale?.documents&&!!e?.documentVersions[id]&&docVersions[id]===e.documentVersions[id]);
 return {conditions,done,oldConditions:(record.conditions||[]).length-conditions.length,oldDocuments:(record.done||[]).length-done.length,
 changed:!!record.noticeRevision&&record.noticeRevision!==noticeRevision(notice,catalog),cancelled:cancelledNotice(notice),entry:e};
}
export function applicationStatus(notice,entry,today=koreaToday()){
 if(cancelledNotice(notice))return {code:'cancelled',label:'취소 공고',end:null};
 const all=entry?.stale?.schedules?[]:entry?.variants||[],periods=all.filter(v=>validNoticeDate(v.dates?.applicationStart)&&validNoticeDate(v.dates?.deadline)&&v.dates.applicationStart<=v.dates.deadline);
 if(!periods.length)return {code:'unknown',label:'접수 일정 확인 필요',end:null};
 const complete=periods.length===all.length,states=periods.map(v=>today<v.dates.applicationStart?'upcoming':today>v.dates.deadline?'closed':'open');
 const code=!complete?'mixed':states.every(s=>s===states[0])?states[0]:'mixed';
 const ends=[...new Set(periods.map(v=>v.dates.deadline))],starts=[...new Set(periods.map(v=>v.dates.applicationStart))];
 const multiple=periods.length>1;
 const label={upcoming:'접수 예정',open:'접수 중',closed:'접수 마감',mixed:'대상별 일정 확인'}[code];
 return {code,label:label+(multiple&&code==='open'?' · 대상별 확인':''),end:complete&&ends.length===1?ends[0]:null,start:complete&&starts.length===1?starts[0]:null,multiple,periods};
}
export function displayNotice(notice,catalog,today=koreaToday()){
 const entry=catalogEntry(notice,catalog),application=applicationStatus(notice,entry,today);
 return {...notice,analysisOutdated:!!catalog?.items?.[notice.id]&&!entry,analysisStale:entry?.stale||{},listingDeadline:notice.listingDeadline||notice.deadline,application,
  ...(application.end?{deadline:application.end,deadlineKind:'application'}:application.periods?.length?{deadline:null,deadlineKind:'variants'}:{})};
}
function eventToken(value){let a=2166136261,b=0x9e3779b9;for(const c of value){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),2246822519)}return (a>>>0).toString(16)+(b>>>0).toString(16)}
const eventNames={applicationStart:'신청 접수 시작',deadline:'신청 접수 마감',documentAnnouncement:'서류 대상자 발표',documentStart:'서류 제출 시작',documentDeadline:'서류 제출 마감',winnerAnnouncement:'당첨자 발표',winnerDocumentDeadline:'당첨자 서류 제출 마감'};
export function noticeEvents(notice,entry,record={},today=koreaToday()){
 const events=[],base={noticeId:notice.id,noticeTitle:notice.title};
 if(cancelledNotice(notice))return [{...base,id:notice.id+':cancelled:'+eventToken(noticeRevision(notice,{items:{[notice.id]:entry}})),kind:'change',title:'취소된 공고예요',description:'준비 기록은 보존했어요. 공식 공고에서 취소 내용을 확인해주세요.',date:notice.posted||today}];
 const review=recordReview(record,notice,{items:{[notice.id]:entry}});
 if(review.changed)events.push({...base,id:notice.id+':revision:'+eventToken(noticeRevision(notice,{items:{[notice.id]:entry}})),kind:'change',title:'공고 자료가 변경됐어요',description:'조건·일정·서류를 다시 확인해주세요. 이전 기록은 보존돼요.',date:notice.posted||today});
 const unique=new Map();
 for(const v of entry?.stale?.schedules?[]:entry?.variants||[])for(const [kind,title] of Object.entries(eventNames)){
  const date=v.dates?.[kind];if(!validNoticeDate(date))continue;
  const diff=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
  if(diff<0||diff>7)continue;
  const phase=diff===0?'today':diff===1?'tomorrow':'soon',id=[notice.id,kind,date,phase].join(':');
  const event=unique.get(id)||{...base,id,kind:'schedule',title:title+(diff===0?' · 오늘':diff===1?' · 내일':' · 7일 이내'),date,scopes:[]};
  if(!event.scopes.includes(v.label))event.scopes.push(v.label);unique.set(id,event);
 }
 return [...events,...[...unique.values()].map(e=>({...e,description:e.scopes.join(' / ')+(e.kind==='schedule'?' · 대상과 시각은 원문 확인':'')}))];
}
