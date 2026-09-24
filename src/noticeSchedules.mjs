import {evidenceNoticeKey} from './noticeEvidence.mjs';
let pending;
export function loadSchedules(){
 if(!pending)pending=fetch('/notice-schedules.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('schedule_http');return r.json()}).then(data=>{if(data?.version!=='schedule-v1'||!data.schedules)throw Error('schedule_format');return data}).catch(e=>{pending=null;throw e});
 return pending;
}
export function matchingSchedule(notice,bundle){
 const key=evidenceNoticeKey(notice?.url),source=key&&bundle?.schedules?.[key];
 if(!source||evidenceNoticeKey(source.noticeUrl)!==key||!Number.isFinite(Date.parse(source.checkedAt))||!Array.isArray(source.variants)||!source.variants.length)return null;
 if(!source.variants.every(v=>v&&typeof v.label==='string'&&v.dates&&typeof v.dates==='object')||!Array.isArray(source.excerpts)||typeof source.detailQuote!=='string')return null;
 return source;
}
