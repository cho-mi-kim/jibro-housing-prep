import evidence from '../public/notice-evidence.json' with {type:'json'};
import schedules from '../public/notice-schedules.json' with {type:'json'};
import {evidenceNoticeKey,validEvidenceSummary} from '../src/noticeEvidence.mjs';

// Serve only the selected notice. The committed snapshots remain the source of
// truth; this endpoint does not claim to collect or refresh LH's live notices.
export function noticeSnapshotResponse(request){
 const url=new URL(request.url),kind=url.pathname==='/api/notice-snapshots/evidence'?'evidence':url.pathname==='/api/notice-snapshots/schedules'?'schedules':null;
 if(!kind)return null;
 const headers={'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'};
 if(!['GET','HEAD'].includes(request.method))return Response.json({error:'method'},{status:405});
 const key=evidenceNoticeKey(url.searchParams.get('url'));
 if(!key)return Response.json({error:'invalid_notice'},{status:400});
 let data;
 if(kind==='evidence'){
  const summary=evidence.summaries[key];
  if(summary&&!validEvidenceSummary(summary,key))return Response.json({error:'invalid_snapshot'},{status:503});
  data={version:'evidence-v1',generatedAt:evidence.generatedAt,summaries:summary?{[key]:summary}:{}};
 }else data={version:'schedule-v1',schedules:schedules.schedules[key]?{[key]:schedules.schedules[key]}:{}};
 return request.method==='HEAD'?new Response(null,{headers:{...headers,'Content-Type':'application/json'}}):Response.json(data,{headers});
}
