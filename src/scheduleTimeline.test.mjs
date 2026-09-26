import {test} from 'node:test';
import assert from 'node:assert/strict';
import {koreaToday,scheduleStages} from './scheduleTimeline.mjs';
import {matchingSchedule} from './noticeSchedules.mjs';
import {evidenceNoticeKey} from './noticeEvidence.mjs';
test('missing stages stay unknown and a closing date does not imply applications have started',()=>{
 const rows=scheduleStages({posted:'2026-09-15',deadline:'2026-09-28'},'2026-09-24');
 assert.equal(rows.length,5);
 assert.equal(rows[0].badge,'게시됨');
 assert.equal(rows[2].badge,'D-4');
 for(const index of [1,3,4])assert.equal(rows[index].status,'unknown');
 assert.ok(!rows.some(r=>r.badge==='접수 중'));
});
test('confirmed application windows and day-zero deadlines use Korean calendar dates',()=>{
 const today=koreaToday(new Date('2026-09-23T15:00:00Z'));
 assert.equal(today,'2026-09-24');
 const rows=scheduleStages({applicationStart:'2026-09-20',deadline:today,documentAnnouncement:'2026-10-01'},today);
 assert.equal(rows[1].badge,'접수 중');
 assert.equal(rows[2].badge,'D-day');
 assert.equal(rows[3].badge,'예정');
 assert.equal(scheduleStages({deadline:'2026-09-23'},today)[2].badge,'지남');
});
test('invalid dates never roll into another month or borrow another stage date',()=>{
 const rows=scheduleStages({posted:'2026-02-30',deadline:'not-a-date',documentDeadline:'2026-10-20'},'2026-09-24');
 assert.equal(rows[0].date,null);
 assert.equal(rows[2].date,null);
 assert.equal(rows[3].date,null);
 assert.equal(rows[4].date,'2026-10-20');
});

test('winner announcements and winner documents keep their actual event names',()=>{
 const rows=scheduleStages({winnerAnnouncement:'2026-11-11',winnerDocumentDeadline:'2026-11-20'},'2026-09-24');
 assert.equal(rows[3].title,'당첨자 발표');
 assert.equal(rows[4].title,'당첨자 서류 제출 마감');
});

test('schedule identity never falls back to a different notice',()=>{
 const url='https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020746&aisTpCd=07&uppAisTpCd=06&ccrCnntSysDsCd=01&mi=1026';
 const source={noticeUrl:url,checkedAt:'2026-09-24T06:00:00Z',variants:[{label:'공통',dates:{deadline:'2026-10-14'}}],excerpts:[],detailQuote:''};
 const bundle={schedules:{[evidenceNoticeKey(url)]:source}};
 assert.equal(matchingSchedule({url},bundle),source);
 assert.equal(matchingSchedule({url:url.replace('20746','29999')},bundle),null);
 source.noticeUrl=url.replace('20746','29999');
 assert.equal(matchingSchedule({url},bundle),null);
});
