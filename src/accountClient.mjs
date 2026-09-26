export const POLICY_VERSION='2026-09-26';
export async function accountRequest(path,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal,headers:{...(options.body?{'Content-Type':'application/json','X-Jibro-Request':'1'}:{}),...options.headers}});
  let data;try{data=await response.json();}catch{throw Error('계정 서비스에 연결하지 못했어요. 잠시 후 다시 시도해주세요.');}
  if(!response.ok){const e=Error(data.message||'요청을 처리하지 못했어요.');e.status=response.status;e.code=data.error;throw e;}return data;
 }catch(error){if(error.name==='AbortError')throw Error('계정 확인이 지연되고 있어요. 다시 시도해주세요.');throw error;}finally{clearTimeout(timer);}
}
export function rememberPending(notice){if(!notice)return;try{sessionStorage.setItem('jibro-auth-pending',JSON.stringify(notice));}catch{}}
export function readPending(){try{const notice=JSON.parse(sessionStorage.getItem('jibro-auth-pending')||'null');return notice&&/^(lh-|imported)[\w-]+$/.test(notice.id)&&typeof notice.title==='string'?notice:null;}catch{return null;}}
export function clearPending(){try{sessionStorage.removeItem('jibro-auth-pending');}catch{}}
export function mergeLocalNotebook(account,local){
 // Keep account records authoritative; add only notices absent from the account.
 const noticeData={...local.noticeData,...account.noticeData},noticeSnapshots={...local.noticeSnapshots,...account.noticeSnapshots};
 return {...account,noticeData,noticeSnapshots,saved:[...new Set([...(account.saved||[]),...(local.saved||[])])],activeNoticeId:account.activeNoticeId||local.activeNoticeId||null,...(!account.activeNoticeId&&local.importedNotice?{importedNotice:local.importedNotice}:{}),done:[],conditions:[]};
}
