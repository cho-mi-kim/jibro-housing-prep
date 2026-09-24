import {koreaToday} from './scheduleTimeline.mjs';

const prefix=/^(?:(?:\[(?:정정|수정|변경|취소)(?:공고)?\]|\((?:정정|수정|변경|취소)(?:공고)?\))\s*)+/;
export const noticeDay=value=>value?new Date(value+'T00:00:00Z').getTime():Infinity;
export const noticeDeadlineLabel=notice=>notice?.deadlineKind==='notice'?'공고 마감':'신청 마감';
export function isOfficialNotice(notice){
 try{return notice?.parsed!==false&&/LH/.test(notice.agency||'')&&new URL(notice.url).origin==='https://apply.lh.or.kr'}catch{return false}
}
export function validNoticeDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const time=noticeDay(value);
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
export function cleanNotices(list,today=koreaToday()){
 const latest=new Map();
 const priority=n=>/취소/.test(n.title.match(prefix)?.[0]||'')?2:prefix.test(n.title)||n.status==='정정공고중'?1:0;
 // Resolve replacement rows first; an expired correction must not revive its original.
 for(const n of list){
  if(!n?.id||!n.title)continue;
  const key=[n.title.replace(prefix,'').replace(/\s+/g,' ').trim(),n.region,n.type].join('|');
  const previous=latest.get(key),rank=n=>[n.posted||'',priority(n),n.id].join('|');
  if(!previous||rank(n)>rank(previous))latest.set(key,n);
 }
 const unique=new Map();
 for(const n of latest.values()){
  if(!['공고중','접수중','정정공고중'].includes(n.status)||priority(n)===2||/^\s*취소공고/.test(n.title)||!validNoticeDate(n.deadline)||n.deadline<today)continue;
  unique.set(n.id,{...n,deadlineKind:n.deadlineKind||'notice'});
 }
 return [...unique.values()].sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.id.localeCompare(b.id));
}
export function validateNoticeSnapshot(data){
 if(!data||!['ok','stale','error'].includes(data.status)||!Array.isArray(data.items))throw Error('notice_format');
 if(data.status!=='error'&&(!data.lastCheckedAt||!Number.isFinite(Date.parse(data.lastCheckedAt))))throw Error('notice_timestamp');
 const ids=new Set();
 for(const n of data.items){
  let url;try{url=new URL(n.url)}catch{throw Error('notice_url')}
  if(!/^lh-\d+$/.test(n.id)||ids.has(n.id)||!n.title?.trim()||!validNoticeDate(n.deadline)||url.protocol!=='https:'||url.hostname!=='apply.lh.or.kr'||url.pathname!=='/lhapply/apply/wt/wrtanc/selectWrtancInfo.do'||url.searchParams.get('panId')!==n.id.slice(3))throw Error('notice_item');
  ids.add(n.id);
 }
 return data;
}
export async function fetchNoticeSnapshot(base,refresh=false,{fetchImpl=fetch,timeoutMs=90000,signal}={}){
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,timeoutMs);
 try{
  const response=await fetchImpl(base.replace(/\/$/,'')+'/api/notices'+(refresh?'/refresh':''),{method:refresh?'POST':'GET',credentials:'include',signal:controller.signal});
  if(!response.ok)throw Error('notice_http');
  return validateNoticeSnapshot(await response.json());
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
