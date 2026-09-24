import fs from 'node:fs';
import {documentEvidenceSummary} from '../src/documentEvidenceSummary.mjs';
const directory=new URL('../public/notice-documents/',import.meta.url);
const report={scope:'Stored notice-document evidence, not a live recrawl or personal eligibility decision',notices:[],counts:{}};
for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.json')).sort()){
 const evidence=JSON.parse(fs.readFileSync(new URL(file,directory)));
 const documents=evidence.documents.map(doc=>{
  const summary=documentEvidenceSummary(doc);
  report.counts[summary.kind]=(report.counts[summary.kind]||0)+1;
  return {id:doc.id,title:doc.title,sourceUrl:doc.sourceUrl,page:doc.page,region:doc.region,requirement:doc.requirement,summary};
 });
 report.notices.push({id:file.replace('.json',''),title:evidence.title,checkedAt:evidence.checkedAt,documents});
}
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({notices:report.notices.length,documents:report.notices.reduce((n,x)=>n+x.documents.length,0),counts:report.counts},null,2));
