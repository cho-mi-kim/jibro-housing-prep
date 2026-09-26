import {recommendDocument} from './documentRecommendations.mjs';
// Evidence is scoped to the exact notice. A mention is never automatically a requirement.
export function noticeEvidenceKey(notice){
 if(/^lh-/.test(notice?.id||''))return notice.id;
 try{const url=new URL(notice?.url);if(url.hostname==='apply.lh.or.kr'){const id=url.searchParams.get('panId');if(id)return 'lh-'+id}}catch{}
 return null;
}
export function documentPlan(notice,record={},evidence={},legacy=[],profile=null,review=null){
 const source=evidence[noticeEvidenceKey(notice)]||null;
 const done=new Set(Array.isArray(record.done)?record.done:[]),choices=record.documentChoices||{};
 const docs=(source?.documents||[]).map(d=>({...legacy.find(old=>old.id===d.id),...d}));
 // Keep old checked entries even when the new official evidence has no matching document.
 for(const id of done){if(docs.some(d=>d.id===id))continue;const old=legacy.find(d=>d.id===id);docs.push({...old,id,title:old?.title||'이전에 준비한 서류',group:'이전 준비 기록',requirement:'legacy',desc:'기존 완료 기록 · 공고 제출 여부 확인',icon:old?.icon||'file'})}
 for(const d of docs){
  const decision=choices[d.id];
  d.included=decision==='include'||(decision!=='exclude'&&(d.requirement==='common'||done.has(d.id)));
  d.excluded=decision==='exclude';d.done=review?review.done.includes(d.id):done.has(d.id);d.previousDone=done.has(d.id)&&!d.done;d.recommendation=recommendDocument(d,profile);
 }
 const included=docs.filter(d=>d.included),pending=docs.filter(d=>!d.included&&!d.excluded),excluded=docs.filter(d=>d.excluded);
 return {source,all:docs,included,pending,excluded,recommended:pending.filter(d=>d.recommendation),count:included.filter(d=>d.done).length,needsReview:!source||pending.length>0};
}
