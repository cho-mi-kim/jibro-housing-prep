import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchingIncomeGuide,moneyInWon,assetInWon} from './incomeGuide.mjs';
const guides=JSON.parse(fs.readFileSync(new URL('./incomeGuides.json',import.meta.url)));
const bundle=JSON.parse(fs.readFileSync(new URL('../public/notice-evidence.json',import.meta.url)));
const key=Object.keys(guides).find(k=>k.includes('panId=2015122300020810&'));
const data=bundle.summaries[key];

test('Chilgok shows 1–4 person limits with small-household allowances, not the first column',()=>{
 const guide=matchingIncomeGuide(data,guides);assert.ok(guide);
 assert.deepEqual(guide.rows.map(r=>r.monthlyWon),[3432027,4693016,5717900,6161541]);
 assert.deepEqual(guide.rows.map(r=>r.percent),[90,80,70,70]);
 assert.equal(assetInWon(guide.totalAssetsWon),'3억 4,500만원');
 assert.equal(assetInWon(guide.carWon),'4,542만원');
 assert.equal(moneyInWon(guide.rows[0].monthlyWon),'3,432,027원');
});
test('changed attachments and other notices cannot borrow a saved money table',()=>{
 assert.equal(matchingIncomeGuide({...data,noticeUrl:data.noticeUrl.replace('2015122300020810','2015122300020696')},guides),null);
 for(const property of ['id','sha256','url'])assert.equal(matchingIncomeGuide({...data,sources:data.sources.map(s=>({...s,[property]:'changed'}))},guides),null);
 assert.equal(matchingIncomeGuide(null,guides),null);
});
test('every published numeric table is tied to its own source and has all four rows',()=>{
 for(const [url,guide] of Object.entries(guides)){
  assert.ok(matchingIncomeGuide(bundle.summaries[url],guides));
  assert.ok(guide.page>0&&guide.quote.includes('가구원'));
  for(const r of guide.rows)assert.ok(guide.quote.includes(new Intl.NumberFormat('en-US').format(r.monthlyWon)));
 }
});
