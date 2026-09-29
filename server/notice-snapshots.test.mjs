import {test} from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../public/notice-evidence.json' with {type:'json'};
import {noticeSnapshotResponse} from './notice-snapshots.mjs';
import {validEvidenceSummary} from '../src/noticeEvidence.mjs';
test('each committed notice is served in isolation with unchanged evidence and no login requirement',async()=>{
 for(const [key,summary] of Object.entries(evidence.summaries)){
  const response=noticeSnapshotResponse(new Request('https://jibro.test/api/notice-snapshots/evidence?url='+encodeURIComponent(key)));
  assert.equal(response.status,200);const data=await response.json();assert.deepEqual(Object.keys(data.summaries),[key]);assert.deepEqual(data.summaries[key],summary);assert.ok(validEvidenceSummary(summary,key));
 }
});
test('invalid notice URLs cannot initiate external fetches or return unrelated data',()=>{
 assert.equal(noticeSnapshotResponse(new Request('https://jibro.test/api/notice-snapshots/evidence?url=https://other.test')).status,400);
 assert.equal(noticeSnapshotResponse(new Request('https://jibro.test/api/notice-snapshots/evidence',{method:'POST'})).status,405);
});
