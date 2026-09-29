import {readFile,writeFile,mkdir} from 'node:fs/promises';
import notices from '../src/lhNotices.js';
import {cleanNotices} from '../src/noticeFeed.mjs';
import {evidenceNoticeKey,validEvidenceSummary} from '../src/noticeEvidence.mjs';
import {matchingReadableGuide} from '../src/readableConditions.mjs';
import {matchingIncomeGuide} from '../src/incomeGuide.mjs';
import {personalCondition,APPLICANT_CONSENT_VERSION} from '../src/applicantProfile.mjs';
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [evidence,guides,incomes]=await Promise.all([json('../public/notice-evidence.json'),json('../src/readableGuides.json'),json('../src/incomeGuides.json')]);
const patterns={age:/연령|나이|생년|성년|세이상|세 이상/,housing:/무주택|주택.*소유|분양권/,household:/가구원|세대구성|세대원/,marriage:/혼인|신혼|배우자/,children:/자녀|신생아|입양|태아/,income:/소득|맞벌이/,assets:/자산|자동차/,residence:/거주|전입|주민등록/,studentWork:/대학생|재학|졸업|취업|재직/,subscription:/청약|납입/,manualExceptions:/수급자|차상위|장애|임신|국가유공|한부모/};
const all=[];
for(const notice of cleanNotices(notices)){
 const key=evidenceNoticeKey(notice.url),data=evidence.summaries[key];
 let docs=null;try{docs=await json('../public/notice-documents/'+notice.id+'.json')}catch{}
 const readable=matchingReadableGuide(data,guides),income=matchingIncomeGuide(data,incomes);
 const text=[...(data?.criteria||[]).flatMap(c=>(c.evidence||[]).map(e=>e.quote)),...Object.values(readable||{}).flat().map(r=>r.text),...(docs?.documents||[]).map(d=>[d.title,d.condition,d.excerpt].join(' '))].join('\n');
 // Exercise every category without borrowing missing limits from another notice.
 for(const size of [1,2,3,4,5])for(const criterion of ['age','house','income','family','eligibility'])personalCondition({profile:{consent:true,consentVersion:APPLICANT_CONSENT_VERSION,householdSize:size,targetGroup:'newlywed'},notice,criterion,rows:readable?.[criterion]||[],incomeGuide:income});
 all.push({id:notice.id,title:notice.title,url:notice.url,evidence:validEvidenceSummary(data,key),readable:!!readable,income:!!income,documentCount:docs?.documents?.length||0,fields:Object.keys(patterns).filter(k=>patterns[k].test(text))});
}
await mkdir('docs',{recursive:true});
const summary={checkedAt:new Date().toISOString(),scope:'Stored current notices, source-bound excerpts and extracted document candidates; not a fresh crawl or full-PDF legal review.',notices:all.length,evidence:all.filter(n=>n.evidence).length,readable:all.filter(n=>n.readable).length,income:all.filter(n=>n.income).length,documents:all.filter(n=>n.documentCount).length,fieldCounts:Object.fromEntries(Object.keys(patterns).map(k=>[k,all.filter(n=>n.fields.includes(k)).length])),missingDocuments:all.filter(n=>!n.documentCount).map(n=>({id:n.id,title:n.title})),items:all};
await writeFile('docs/applicant-profile-audit.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,items:undefined},null,2));
