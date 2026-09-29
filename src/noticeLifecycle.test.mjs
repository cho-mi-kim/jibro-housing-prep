import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogEntry,noticeRevision,recordReview,applicationStatus,displayNotice,noticeEvents} from './noticeLifecycle.mjs';
import {documentPlan} from './noticeDocuments.mjs';
import {normalizeNotebook} from '../server/notebook.mjs';
const notice={id:'lh-12345678',title:'국민임대',posted:'2026-09-01',deadline:'2026-12-31',deadlineKind:'notice',status:'공고중',url:'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=12345678&mi=1026'};
const entry={notice,key:notice.url,revision:'source-v1',versions:{conditions:'c1'},documentVersions:{resident:'d1'},variants:[{label:'일반',dates:{applicationStart:'2026-09-28',deadline:'2026-09-29',documentAnnouncement:'2026-10-01'}}]};
const catalog={items:{[notice.id]:entry}};
test('listing closure never becomes an application deadline; date-only boundary remains D-day',()=>{
 assert.equal(applicationStatus(notice,null,'2026-09-26').code,'unknown');
 assert.equal(applicationStatus(notice,entry,'2026-09-26').code,'upcoming');
 assert.equal(applicationStatus(notice,entry,'2026-09-29').code,'open');
 assert.equal(applicationStatus(notice,entry,'2026-09-30').code,'closed');
 const shown=displayNotice(notice,catalog,'2026-09-26');assert.equal(shown.deadline,'2026-09-29');assert.equal(shown.listingDeadline,'2026-12-31');
 assert.equal(noticeRevision(shown,catalog),noticeRevision(notice,catalog));
});
test('different rank schedules or missing date never collapse to one closing day',()=>{
 const multi={...entry,variants:[...entry.variants,{label:'2순위',dates:{applicationStart:'2026-09-30',deadline:'2026-09-30'}}]};
 assert.equal(applicationStatus(notice,multi,'2026-09-29').code,'mixed');assert.equal(applicationStatus(notice,multi).end,null);
 assert.equal(applicationStatus(notice,{...entry,variants:[...entry.variants,{label:'우편',dates:{}}]}).code,'mixed');
 assert.equal(applicationStatus(notice,{...entry,variants:[{label:'오류',dates:{applicationStart:'2026-02-30',deadline:'2026-03-01'}}]}).code,'unknown');
});
test('different notice or changed title cannot reuse saved analysis',()=>{
 assert.ok(catalogEntry(notice,catalog));assert.equal(catalogEntry({...notice,title:'[정정공고] 국민임대'},catalog),null);
 assert.equal(catalogEntry({...notice,url:notice.url.replace('12345678','99999999')},catalog),null);
});
test('legacy and changed checks remain recorded but no longer count as current; rechecking one does not validate others',()=>{
 const record={conditions:['age','house'],done:['resident'],conditionVersions:{age:'c1',house:'old'},documentVersions:{resident:'old'},noticeRevision:'old'};
 const result=recordReview(record,notice,catalog);assert.deepEqual(result.conditions,['age']);assert.deepEqual(result.done,[]);assert.equal(result.oldConditions,1);assert.equal(result.oldDocuments,1);assert.equal(result.changed,true);
 assert.deepEqual(record.conditions,['age','house']);assert.deepEqual(record.done,['resident']);
 assert.equal(recordReview({conditions:['age']},notice,catalog).oldConditions,1);
});
test('profile only prioritizes existing candidates and never changes explicit choices or done history',()=>{
 const evidence={[notice.id]:{documents:[{id:'resident',title:'주민등록표등본',requirement:'common'},{id:'marriage',title:'혼인관계증명서',requirement:'check'},{id:'pregnancy',title:'임신진단서·임신확인서',requirement:'check'},{id:'student',title:'재학증명서',requirement:'check'}]}};
 const profile={maritalStatus:'married',targetGroup:'newborn'},record={documentChoices:{resident:'exclude'},done:['resident']};
 const plan=documentPlan(notice,record,evidence,[],profile);assert.deepEqual(plan.recommended.map(d=>d.id),['marriage']);assert.equal(plan.included.length,0);assert.equal(plan.excluded[0].done,true);
 const changed=documentPlan(notice,record,evidence,[],{targetGroup:'student'});assert.deepEqual(changed.recommended.map(d=>d.id),['student']);assert.deepEqual(record.done,['resident']);
});
test('event IDs deduplicate scopes, change at today boundary, and are scoped to each notice',()=>{
 const multi={...entry,variants:[...entry.variants,{...entry.variants[0],label:'다른 대상'}]};
 const before=noticeEvents(notice,multi,{},'2026-09-27');assert.equal(before.filter(e=>e.title.startsWith('신청 접수 시작')).length,1);
 const due=noticeEvents(notice,multi,{},'2026-09-28');assert.notEqual(before[0].id,due[0].id);
 assert.ok(noticeEvents({...notice,id:'lh-87654321'},multi,{},'2026-09-27').every(e=>!before.some(a=>a.id===e.id)));
 assert.equal(noticeEvents(notice,entry,{},'2027-01-01').length,0);
 const change=noticeEvents(notice,entry,{noticeRevision:'old'},'2026-09-27')[0];assert.equal(change.kind,'change');assert.ok(change.id.length<180);
});
test('notification reads and per-item source versions survive encrypted notebook normalization',()=>{
 const value=normalizeNotebook({activeNoticeId:notice.id,notificationReads:['event1','event1'],noticeData:{[notice.id]:{conditions:['age'],conditionVersions:{age:'c1'},documentVersions:{resident:'d1'},noticeRevision:noticeRevision(notice,catalog)}}});
 assert.deepEqual(value.notificationReads,['event1']);assert.equal(value.noticeData[notice.id].conditionVersions.age,'c1');assert.equal(value.noticeData[notice.id].documentVersions.resident,'d1');assert.equal(value.noticeData[notice.id].noticeRevision,noticeRevision(notice,catalog));
 assert.deepEqual(normalizeNotebook({}).notificationReads,[]);
});

test('cancelled and stale schedules cannot emit actionable date events or count old evidence',()=>{
 const cancelled={...notice,title:'[정정공고][취소공고] 국민임대'};
 assert.equal(applicationStatus(cancelled,entry).code,'cancelled');assert.equal(noticeEvents(cancelled,entry,{},'2026-09-27').length,1);
 const stale={...entry,stale:{conditions:true,documents:true,schedules:true}};
 assert.equal(applicationStatus(notice,stale).code,'unknown');assert.equal(noticeEvents(notice,stale,{},'2026-09-27').length,0);
 assert.equal(recordReview({conditions:['age'],conditionVersions:{age:'c1'},done:['resident'],documentVersions:{resident:'d1'}},notice,{items:{[notice.id]:stale}}).done.length,0);
});

test('a changed deadline or status cannot borrow unchanged cached application dates',()=>{
 assert.equal(catalogEntry({...notice,deadline:'2026-10-01'},catalog),null);
 assert.equal(catalogEntry({...notice,status:'취소'},catalog),null);
 assert.equal(displayNotice({...notice,deadline:'2026-10-01'},catalog).application.code,'unknown');
});
