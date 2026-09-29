import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextSchedule} from './nextSchedule.mjs';

test('next event includes today and moves from reception to later document dates',()=>{
 const source={variants:[{dates:{applicationStart:'2026-09-20',deadline:'2026-09-24',documentAnnouncement:'2026-10-01',documentStart:'2026-10-03',documentDeadline:'2026-10-05'}}]};
 assert.equal(nextSchedule({},source,'2026-09-24').id,'deadline');
 assert.equal(nextSchedule({},source,'2026-09-24').today,true);
 assert.equal(nextSchedule({},source,'2026-09-25').id,'documentAnnouncement');
 assert.equal(nextSchedule({},source,'2026-10-02').id,'documentStart');
 assert.equal(nextSchedule({},source,'2026-10-06'),null);
});
test('earliest rank date is selected without substituting stale notice dates',()=>{
 const source={variants:[{dates:{deadline:'2026-10-20'}},{dates:{applicationStart:'2026-10-12'}}]};
 const result=nextSchedule({deadline:'2026-09-25'},source,'2026-09-24');
 assert.equal(result.date,'2026-10-12');
 assert.equal(result.hasVariants,true);
 assert.equal(nextSchedule({deadline:'2026-02-30'},null,'2026-02-20'),null);
 assert.equal(nextSchedule({deadline:'2026-09-28'},null,'2026-09-24').date,'2026-09-28');
});
