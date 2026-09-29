import {HttpError} from './notebook.mjs';
export function mailAvailable(env){return !!env.JIBRO_RESEND_API_KEY&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.JIBRO_MAIL_FROM||'');}
export function requireMail(env){if(!mailAvailable(env))throw new HttpError(503,'email_unavailable','이메일 발송 기능을 준비 중이에요. 연결이 완료되면 이용할 수 있어요.');}
export function authMail(env,{user,token},kind){
 const url=new URL('/auth/complete',env.JIBRO_APP_ORIGIN);
 // Fragments are not sent in HTTP requests or Referer headers.
 url.hash=new URLSearchParams({action:kind,token}).toString();
 const title=kind==='verify'?'이메일 주소 확인':'비밀번호 재설정';
 return {from:`JIBRO <${env.JIBRO_MAIL_FROM}>`,to:[user.email],subject:`[JIBRO] ${title}`,text:`${title}을 요청하셨나요?\n\n아래 링크를 열어 직접 확인해주세요. 링크는 30분 동안 유효해요.\n${url.href}\n\n요청하지 않았다면 이 메일을 무시해주세요. 비밀번호나 신청 조건을 회신하지 마세요.`};
}
export async function deliverAuthMail(env,data,kind,fetcher=(...args)=>fetch(...args)){
 requireMail(env);
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${env.JIBRO_RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(authMail(env,data,kind))});
 if(!response.ok)throw new Error('email_delivery_failed');
 const result=await response.json();if(!result?.id)throw new Error('email_delivery_failed');
}
export function scheduleAuthMail(env,ctx,data,kind){
 const delivery=deliverAuthMail(env,data,kind).catch(()=>{console.error('Account email delivery failed:',kind);});
 // Never log addresses, links, tokens, provider responses or credentials.
 if(ctx?.waitUntil){ctx.waitUntil(delivery);return Promise.resolve();}
 return delivery;
}
