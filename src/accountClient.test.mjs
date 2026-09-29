import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeLocalNotebook,accountRequest} from './accountClient.mjs';
test('local import preserves member records, unions favorites, and never changes an active member notice',()=>{
 const member={name:'회원',activeNoticeId:'lh-a',noticeData:{'lh-a':{done:['saved']}},noticeSnapshots:{'lh-a':{title:'계정'}},saved:['lh-a']};
 const local={activeNoticeId:'lh-b',noticeData:{'lh-a':{done:['old']},'lh-b':{done:['local']}},noticeSnapshots:{'lh-a':{title:'기기'},'lh-b':{title:'추가'}},saved:['lh-b','lh-a']};
 const merged=mergeLocalNotebook(member,local);assert.equal(merged.activeNoticeId,'lh-a');assert.deepEqual(merged.noticeData['lh-a'].done,['saved']);assert.deepEqual(merged.noticeData['lh-b'].done,['local']);assert.deepEqual(merged.saved,['lh-a','lh-b']);assert.equal(merged.noticeSnapshots['lh-a'].title,'계정');assert.deepEqual(local.noticeData['lh-a'].done,['old']);
});

test('writes fetch a fresh CSRF token and retain cookies and JSON request headers',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/csrf')?{headerName:'X-XSRF-TOKEN',token:'masked-token'}:{ok:true});});
 await accountRequest('/api/account/login',{method:'POST',body:JSON.stringify({email:'member@example.test',password:'test-only'})});
 assert.deepEqual(calls.map(c=>c.url),['/api/account/csrf','/api/account/login']);
 assert.equal(calls[1].options.headers['X-XSRF-TOKEN'],'masked-token');assert.equal(calls[1].options.headers['X-Jibro-Request'],'1');assert.equal(calls[1].options.credentials,'same-origin');
});
test('invalid CSRF responses stop writes; GET and conflicts retain their meaning',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async url=>{calls.push(url);return Response.json({error:'unavailable'},{status:503});});
 await assert.rejects(accountRequest('/api/account/register',{method:'POST',body:'{}'}));assert.deepEqual(calls,['/api/account/csrf']);
 calls.length=0;await assert.rejects(accountRequest('/api/account'),e=>e.status===503);assert.deepEqual(calls,['/api/account']);
 t.mock.method(globalThis,'fetch',async url=>Response.json(url.endsWith('/csrf')?{headerName:'X-XSRF-TOKEN',token:'new-token'}:{error:'conflict',message:'다른 창에서 수정됐어요.'},{status:url.endsWith('/csrf')?200:409}));
 await assert.rejects(accountRequest('/api/member-notebook',{method:'PUT',body:'{}'}),e=>e.status===409&&e.code==='conflict');
});
