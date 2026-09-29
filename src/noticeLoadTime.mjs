export function noticeLoadTime(value){
 if(!value||!Number.isFinite(Date.parse(value)))return '공고 불러온 시각 · 확인 필요';
 const parts=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
 const p=Object.fromEntries(parts.map(({type,value})=>[type,value]));
 return `공고 불러온 시각 · ${p.year}. ${p.month}. ${p.day}. ${p.hour}:${p.minute}`;
}
