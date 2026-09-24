import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {conditionItemsForNotice,conditionRowsForNotice} from './conditionProfile.mjs';

const items=['age','house','income','family'].map(id=>({id,title:id}));
test('family notices use a separate confirmation instead of inheriting an age check',()=>{
 const next=conditionItemsForNotice({title:'신혼·신생아 매입임대'},items);
 assert.deepEqual(next.map(c=>c.id),['eligibility','house','income','family']);
 assert.equal(next.filter(c=>['age','house'].includes(c.id)).length,1);
 assert.equal(conditionItemsForNotice({title:'청년 매입임대'},items),items);
 assert.equal(conditionItemsForNotice({title:'국민임대'},items),items);
});

test('marriage and newborn summaries move with their own evidence without duplicating other households',()=>{
 const guides=JSON.parse(fs.readFileSync(new URL('./readableGuides.json',import.meta.url)));
 const guide=Object.values(guides).find(g=>['신혼부부','예비신혼부부','신생아 가구','한부모가족'].every(label=>g.criteria.family.some(r=>r.label===label)));
 assert.ok(guide);
 const result=conditionRowsForNotice({title:'신혼·신생아 모집'},guide.criteria);
 assert.deepEqual(result.eligibility.map(r=>r.label),['신혼부부','예비신혼부부','신생아 가구']);
 assert.ok(result.family.some(r=>r.label==='한부모가족'));
 for(const row of result.eligibility){
  assert.ok(guide.criteria.family.includes(row));
  assert.ok(row.evidence.sourceUrl&&row.evidence.quote);
  assert.ok(!result.family.includes(row));
 }
 assert.equal(result.income,guide.criteria.income);
 assert.equal(conditionRowsForNotice({title:'국민임대'},guide.criteria),guide.criteria);
});

test('missing or waived marriage/newborn evidence never receives default thresholds',()=>{
 const result=conditionRowsForNotice({title:'신혼·신생아 완화 모집'},{age:[{text:'성년자'}],family:[]});
 assert.deepEqual(result.eligibility,[]);
 assert.deepEqual(result.family,[]);
});
