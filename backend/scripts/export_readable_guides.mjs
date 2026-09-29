import fs from 'node:fs';
import {readableConditions} from '../../src/readableConditions.mjs';
const pages=JSON.parse(fs.readFileSync('.sites-runtime/condition-pages.json','utf8'));
const guides={},report=[];
for(const [key,n] of Object.entries(pages)){
 const evidence=n.pages.length?n.pages:n.criteria.flatMap(c=>c.evidence.map(e=>({...e,sha256:n.sources.find(s=>s.id===e.sourceId)?.sha256})));
 const criteria=readableConditions(evidence,n.title);
 guides[key]={noticeUrl:key,criteria};
 report.push({title:n.title,key,coverage:Object.fromEntries(Object.entries(criteria).map(([k,r])=>[k,r.length])),rows:Object.fromEntries(Object.entries(criteria).map(([k,r])=>[k,r.map(x=>x.label+': '+x.text)]))});
}
fs.writeFileSync('src/readableGuides.json',JSON.stringify(guides,null,2));
fs.writeFileSync('.sites-runtime/readable-guide-audit.json',JSON.stringify(report,null,2));
for(const key of ['age','house','income','family'])console.log(key,report.filter(r=>r.coverage[key]).length,'/',report.length);
console.log('NO_EXTRA_RULES',report.filter(r=>Object.values(r.coverage).every(c=>!c)).map(r=>r.title));
