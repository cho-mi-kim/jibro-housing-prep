import {normalizeApplicantProfile} from '../src/applicantProfile.mjs';
export class HttpError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
export function validatedApplicantProfile(value){try{return normalizeApplicantProfile(value)}catch(e){throw new HttpError(400,'applicant_profile',e.message)}}
export function normalizeNotebook(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(400,'notebook','준비 기록 형식을 확인해주세요.');
 const obj=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const ids=value=>Array.isArray(value)?[...new Set(value.filter(v=>typeof v==='string'&&v.length<180))].slice(0,1000):[];
 const revision=value=>typeof value==='string'&&value.length<=2400?value:null;
 const versions=value=>Object.fromEntries(Object.entries(obj(value)).filter(([k,v])=>k.length<180&&revision(v)).slice(0,1000));
 const record=value=>{const v=obj(value);return {done:ids(v.done),conditions:ids(v.conditions),documentChoices:obj(v.documentChoices),conditionVersions:versions(v.conditionVersions),documentVersions:versions(v.documentVersions),noticeRevision:revision(v.noticeRevision),...(v.rankProfile?{rankProfile:obj(v.rankProfile)}:{})};};
 const noticeData={};for(const [key,value] of Object.entries(obj(input.noticeData)).slice(0,300)){if(/^(lh-|imported)[\w-]{1,120}$/.test(key))noticeData[key]=record(value);}
 const activeNoticeId=typeof input.activeNoticeId==='string'&&/^(lh-|imported)[\w-]{1,120}$/.test(input.activeNoticeId)?input.activeNoticeId:null;
 const snapshots={};for(const [key,value] of Object.entries(obj(input.noticeSnapshots)).slice(0,300)){if(!/^(lh-|imported)[\w-]{1,120}$/.test(key))continue;const n=obj(value);let url;try{url=new URL(n.url);}catch{continue;}if(!['https:','http:'].includes(url.protocol)||url.username||url.password)continue;snapshots[key]={...n,id:key,url:url.href,title:String(n.title||'').slice(0,700)};}
 return {name:String(input.name||'회원').slice(0,16),region:String(input.region||'전국').slice(0,50),saved:ids(input.saved),notificationReads:ids(input.notificationReads),reminder:input.reminder!==false,activeNoticeId,noticeData,noticeSnapshots:snapshots,applicantProfile:validatedApplicantProfile(input.applicantProfile),...record(noticeData[activeNoticeId]),...(input.importedNotice&&snapshots[input.importedNotice.id]?{importedNotice:snapshots[input.importedNotice.id]}:{})};
}
