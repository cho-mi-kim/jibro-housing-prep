import {evidenceNoticeKey} from './noticeEvidence.mjs';
const cache=new Map();
export function loadSchedules(key=null,{force=false}={}){
 const id=key||'all';if(force)cache.delete(id);
 if(!cache.has(id))cache.set(id,(async()=>{
  const options={cache:'no-cache',signal:AbortSignal.timeout(15000)};
  let r=await fetch(key?'/api/notice-snapshots/schedules?url='+encodeURIComponent(key):'/notice-schedules.json',options);
  if(key&&(r.status===404||(r.ok&&!r.headers.get('content-type')?.includes('application/json'))))r=await fetch('/notice-schedules.json',options);
  if(!r.ok)throw Error('schedule_http');const data=await r.json();
  if(data?.version!=='schedule-v1'||!data.schedules)throw Error('schedule_format');return data;
 })().catch(e=>{cache.delete(id);throw e}));
 return cache.get(id);
}
export function matchingSchedule(notice,bundle){
 if(notice?.analysisOutdated||notice?.analysisStale?.schedules)return null;
 const key=evidenceNoticeKey(notice?.url),source=key&&bundle?.schedules?.[key];
 if(!source||evidenceNoticeKey(source.noticeUrl)!==key||!Number.isFinite(Date.parse(source.checkedAt))||!Array.isArray(source.variants)||!source.variants.length)return null;
 if(!source.variants.every(v=>v&&typeof v.label==='string'&&v.dates&&typeof v.dates==='object')||!Array.isArray(source.excerpts)||typeof source.detailQuote!=='string')return null;
 return source;
}
