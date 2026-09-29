import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanNotices,fetchNoticeSnapshot,validateNoticeSnapshot,noticeDeadlineLabel,isOfficialNotice} from './noticeFeed.mjs';
import {scheduleStages} from './scheduleTimeline.mjs';
import {nextSchedule} from './nextSchedule.mjs';
import {deadlineText} from './data.js';
const notice=(id,title,patch={})=>({id:'lh-'+id,title,region:'서울',type:'국민임대',deadline:'2026-09-25',posted:'2026-09-20',status:'공고중',url:`https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=${id}`,...patch});
const snapshot=items=>({status:'ok',items,lastCheckedAt:'2026-09-24T17:20:00Z'});

test('a saved link or lookalike domain never receives the official LH label',()=>{
 assert.equal(isOfficialNotice({url:'https://apply.lh.or.kr',parsed:false,agency:'LH'}),false);
 assert.equal(isOfficialNotice({url:'https://evil-lh.or.kr',parsed:true,agency:'LH'}),false);
 assert.equal(isOfficialNotice({...notice('1','A'),agency:'한국토지주택공사 (LH)'}),true);
});

test('corrections and cancellations supersede originals before deadline filtering',()=>{
 const rows=[notice('1','A'),notice('2','[정정공고][정정공고] A',{deadline:'2026-09-24',posted:'2026-09-21'}),notice('3','B'),notice('4','[정정공고][취소공고] B'),notice('5','C',{deadline:'2026-02-30'})];
 assert.deepEqual(cleanNotices(rows,'2026-09-25'),[]);
});
test('Korean calendar includes deadline day, removes past dates and handles all active statuses',()=>{
 const rows=['공고중','접수중','정정공고중','접수마감'].map((status,i)=>notice(String(i+1),String(i),{status}));
 assert.equal(cleanNotices(rows,'2026-09-25').length,3);
 assert.equal(cleanNotices(rows,'2026-09-26').length,0);
 assert.equal(cleanNotices(rows,'2026-09-25')[0].deadlineKind,'notice');
});
test('listing deadline is never substituted into an application schedule',()=>{
 const n=cleanNotices([notice('1','A')],'2026-09-25')[0];
 assert.equal(noticeDeadlineLabel(n),'공고 마감');
 assert.equal(scheduleStages(n,'2026-09-25').find(s=>s.id==='deadline').date,null);
 assert.equal(nextSchedule(n,null,'2026-09-25'),null);
 assert.equal(nextSchedule(n,{variants:[{dates:{deadline:'2026-09-28'}}]},'2026-09-25').date,'2026-09-28');
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 assert.equal(deadlineText(today),'D-day');
});
test('valid empty success differs from failed, stale or malformed results',()=>{
 assert.deepEqual(validateNoticeSnapshot(snapshot([])).items,[]);
 assert.equal(validateNoticeSnapshot({...snapshot([notice('1','A')]),status:'stale'}).status,'stale');
 for(const value of [{}, {...snapshot([]),lastCheckedAt:null},snapshot([notice('1','A'),notice('1','A')]),snapshot([notice('1','A',{url:'https://evil-lh.or.kr/'})])])assert.throws(()=>validateNoticeSnapshot(value));
});
test('refresh makes one POST and validates result; unavailable and timeout reject',async()=>{
 const calls=[];
 const value=await fetchNoticeSnapshot('http://localhost:8080/',true,{fetchImpl:async(url,options)=>{calls.push([url,options.method]);return {ok:true,json:async()=>snapshot([])}}});
 assert.equal(value.status,'ok');assert.deepEqual(calls,[['http://localhost:8080/api/notices/refresh','POST']]);
 await assert.rejects(fetchNoticeSnapshot('http://localhost:8080',false,{fetchImpl:async()=>({ok:false})}));
 await assert.rejects(fetchNoticeSnapshot('http://localhost:8080',false,{timeoutMs:5,fetchImpl:(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError'))))}),{name:'AbortError'});
});
