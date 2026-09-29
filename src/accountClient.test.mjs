import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeLocalNotebook} from './accountClient.mjs';
test('local import preserves member records, unions favorites, and never changes an active member notice',()=>{
 const member={name:'회원',activeNoticeId:'lh-a',noticeData:{'lh-a':{done:['saved']}},noticeSnapshots:{'lh-a':{title:'계정'}},saved:['lh-a']};
 const local={activeNoticeId:'lh-b',noticeData:{'lh-a':{done:['old']},'lh-b':{done:['local']}},noticeSnapshots:{'lh-a':{title:'기기'},'lh-b':{title:'추가'}},saved:['lh-b','lh-a']};
 const merged=mergeLocalNotebook(member,local);assert.equal(merged.activeNoticeId,'lh-a');assert.deepEqual(merged.noticeData['lh-a'].done,['saved']);assert.deepEqual(merged.noticeData['lh-b'].done,['local']);assert.deepEqual(merged.saved,['lh-a','lh-b']);assert.equal(merged.noticeSnapshots['lh-a'].title,'계정');assert.deepEqual(local.noticeData['lh-a'].done,['old']);
});
