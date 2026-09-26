import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import notices from '../src/lhNotices.js';
import {evidenceNoticeKey,validEvidenceSummary} from '../src/noticeEvidence.mjs';
import {matchingSchedule} from '../src/noticeSchedules.mjs';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
let previous={items:{}};try{previous=await read('src/noticeCatalog.json')}catch(error){if(error.code!=='ENOENT')throw error}
let attempts={attempts:{}};try{attempts=await read('public/notice-analysis-attempts.json')}catch(error){if(error.code!=='ENOENT')throw error}
const evidence=await read('public/notice-evidence.json'),schedules=await read('public/notice-schedules.json'),items={};
for(const n of notices){
 const key=evidenceNoticeKey(n.url),e=evidence.summaries[key],s=matchingSchedule(n,schedules);
 let d=null;try{d=await read('public/notice-documents/'+n.id+'.json')}catch(error){if(error.code!=='ENOENT')throw error}
 if(d&&evidenceNoticeKey(d.url)!==key)throw Error('Document identity mismatch: '+n.id);
 if(e&&!validEvidenceSummary(e,key))throw Error('Invalid evidence: '+n.id);
 const conditions=e?.criteria||[],documents=d?.documents||[];
 const rawVersions={conditions:hash({sources:e?.sources||[],criteria:conditions}),documents:hash(documents),schedules:hash(s?.variants||[])};
 const old=previous.items[n.id],identity=[n.title,n.posted,n.status,n.deadline],identityChanged=old&&JSON.stringify([old.notice.title,old.notice.posted,old.notice.status,old.notice.deadline])!==JSON.stringify(identity);
 const stale=Object.fromEntries(Object.keys(rawVersions).map(k=>[k,!!((identityChanged||old?.stale?.[k])&&(old.rawVersions?.[k]||old.versions[k])===rawVersions[k])]));
 if(old?.rawVersions&&old.rawVersions.conditions!==rawVersions.conditions){if(old.rawVersions.documents===rawVersions.documents)stale.documents=true;if(old.rawVersions.schedules===rawVersions.schedules)stale.schedules=true;}
 const versions=Object.fromEntries(Object.entries(rawVersions).map(([k,v])=>[k,hash([identity,v,stale[k]])]));
 items[n.id]={notice:n,key,revision:hash({notice:n,versions}),versions,rawVersions,stale,documentVersions:Object.fromEntries(documents.map(doc=>[doc.id,hash([identity,doc,stale.documents])])),
  analysis:{conditions:conditions.some(c=>c.evidence?.length)?'excerpt':e?'unavailable':'pending',documents:d?'candidates':'pending',schedules:s?'available':'pending'},
  attempts:attempts.attempts[key]||{},checkedAt:{conditions:e?.checkedAt||null,documents:d?.checkedAt||null,schedules:s?.checkedAt||null},variants:s?.variants||[]};
}
await writeFile(new URL('../src/noticeCatalog.json',import.meta.url),JSON.stringify({version:1,items}));
console.log('Notice catalog: '+Object.keys(items).length+' notices; missing analysis remains explicit');
