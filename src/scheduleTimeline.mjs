const DAY=86400000;
function dayNumber(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
 const date=new Date(value+'T00:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value?date.getTime()/DAY:null;
}
export function koreaToday(now=new Date()){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function scheduleStages(notice={},today=koreaToday()){
 if(notice.deadlineKind==='notice')notice={...notice,deadline:null};
 const current=dayNumber(today),start=dayNumber(notice.applicationStart),end=dayNumber(notice.deadline);
 const definitions=[
  ['posted','공고 게시',notice.posted],
  ['applicationStart','신청 접수 시작',notice.applicationStart],
  ['deadline','신청 접수 마감',notice.deadline],
  ['documentAnnouncement','서류 제출 대상자 발표',notice.documentAnnouncement],
  ['documentDeadline','서류 제출 마감',notice.documentDeadline]
 ];
 if(!notice.documentAnnouncement&&notice.winnerAnnouncement)definitions[3]=['winnerAnnouncement','당첨자 발표',notice.winnerAnnouncement];
 if(!notice.documentDeadline&&notice.winnerDocumentDeadline)definitions[4]=['winnerDocumentDeadline','당첨자 서류 제출 마감',notice.winnerDocumentDeadline];
 return definitions.map(([id,title,value])=>{
  const day=dayNumber(value),date=day===null?null:value,diff=day===null||current===null?null:day-current;
  const ongoing=id==='applicationStart'&&start!==null&&end!==null&&start<=current&&current<=end;
  const closing=id==='deadline'||id==='documentDeadline'||id==='winnerDocumentDeadline';
  const status=diff===null?'unknown':ongoing?'current':diff<0?'past':diff===0?'today':'future';
  const badge=diff===null?'확인 필요':ongoing?'접수 중':diff<0?(id==='posted'?'게시됨':'지남'):diff===0?(closing?'D-day':'오늘'):closing?`D-${diff}`:'예정';
  return {id,title,date,status,badge,diff};
 });
}
