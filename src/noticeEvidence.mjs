export function evidenceNoticeKey(raw){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.hostname!=='apply.lh.or.kr'||u.port||u.username||u.password||u.pathname!=='/lhapply/apply/wt/wrtanc/selectWrtancInfo.do')return null;
  const pan=u.searchParams.get('panId');if(!/^\d{8,30}$/.test(pan||''))return null;
  const q=new URLSearchParams();
  for(const key of ['panId','ccrCnntSysDsCd','aisTpCd','uppAisTpCd']){const value=u.searchParams.get(key);if(value!==null){if(!/^\d{1,30}$/.test(value))return null;q.set(key,value);}}
  q.set('mi','1026');return u.origin+u.pathname+'?'+q;
 }catch{return null}
}
export function validEvidenceSummary(data,key){
 return !!key&&data?.version==='evidence-v1'&&evidenceNoticeKey(data.noticeUrl)===key&&Array.isArray(data.criteria)&&Array.isArray(data.sources)&&['ready','partial','unavailable'].includes(data.status)&&Number.isFinite(Date.parse(data.checkedAt));
}
export function evidenceSourceLink(value,page){
 try{const u=new URL(value);if(u.origin!=='https://apply.lh.or.kr'||u.pathname!=='/lhapply/lhFile.do'||!/^\d+$/.test(u.searchParams.get('fileid')||''))return null;return u.href+(Number.isInteger(page)&&page>0?'#page='+page:'');}catch{return null}
}

// Cache successful snapshots only; transport failures must not look like missing evidence.
export function createEvidenceLoader(fetcher=globalThis.fetch,{timeoutMs=15000,maxAgeMs=300000}={}){
 let pending=null,expires=0;
 return function load({force=false}={}){
  if(pending&&!force&&Date.now()<expires)return pending;
  const controller=new AbortController();let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('snapshot_timeout'))},timeoutMs)});
  const request=Promise.race([Promise.resolve().then(async()=>{
   const response=await fetcher('/notice-evidence.json',{signal:controller.signal,cache:'no-cache'});
   if(!response.ok)throw new Error('snapshot_http');
   const data=await response.json();
   if(data?.version!=='evidence-v1'||!data.summaries||typeof data.summaries!=='object'||Array.isArray(data.summaries))throw new Error('snapshot_invalid');
   return data;
  }),timeout]).catch(error=>{if(pending===request)pending=null;throw error}).finally(()=>clearTimeout(timer));
  pending=request;expires=Date.now()+maxAgeMs;return request;
 }
}

export function evidenceLocation(e){
 if(/\.hwpx$/i.test(e.sourceName||''))return 'HWPX · '+(e.region||'본문');
 return `PDF ${e.page}쪽${e.region?` (${e.region})`:''}`;
}
