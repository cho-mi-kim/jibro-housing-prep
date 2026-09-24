import {koreaToday} from './scheduleTimeline.mjs';

const events=[['applicationStart','신청 접수 시작'],['deadline','신청 접수 마감'],['documentAnnouncement','서류 대상자 발표'],['documentStart','서류 제출 시작'],['documentDeadline','서류 제출 마감'],['winnerAnnouncement','당첨자 발표'],['winnerDocumentStart','당첨자 서류 제출 시작'],['winnerDocumentDeadline','당첨자 서류 제출 마감']];
function validDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const parsed=new Date(value+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function nextSchedule(notice,source,today=koreaToday()){
 const variants=source?.variants?.length?source.variants:[{dates:notice||{}}];
 const upcoming=variants.flatMap(v=>events.flatMap(([id,title],order)=>{
  const date=v.dates[id];
  return validDate(date)&&date>=today?[{id,title,date,order}]:[];
 })).sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order);
 return upcoming[0]?{...upcoming[0],today:upcoming[0].date===today,hasVariants:variants.length>1}:null;
}
