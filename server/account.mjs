import {signupNickname} from '../src/signupFlow.mjs';
import {createAuth,POLICY_VERSION} from './auth.mjs';
import {HttpError,normalizeNotebook,validatedApplicantProfile} from './notebook.mjs';
import {json,writeGuard,body} from './request.mjs';
import {canUseTestAccount,testLoginEmail,TEST_USER_ID,TEST_EMAIL} from './test-account.mjs';
import {notebookCipher,readNotebook,migrateLegacyNotebooks} from './notebook-crypto.mjs';
import {mailAvailable,requireMail} from './mail.mjs';
const publicMember=u=>({id:u.id,email:u.email,nickname:u.name,emailVerified:u.emailVerified===true});
async function requireMember(auth,request,env){const s=await auth.api.getSession({headers:request.headers});if(!s?.user||(s.user.id===TEST_USER_ID&&!canUseTestAccount(request,env)))throw new HttpError(401,'login_required','로그인 후 이용해주세요.');return s.user;}
async function authAction(auth,request,path,data){
 const url=new URL('/api/auth'+path,request.url),headers=new Headers(request.headers);headers.delete('content-length');headers.set('content-type','application/json');
 const result=await auth.handler(new Request(url,{method:'POST',headers,body:JSON.stringify(data)}));
 const payload=await result.json().catch(()=>({}));
 if(!result.ok){
  const message=result.status===429?'시도가 많아요. 잠시 후 다시 시도해주세요.':/TOKEN/.test(payload.code||'')?'링크가 만료되었거나 사용할 수 없어요. 새 메일을 요청해주세요.':path==='/sign-in/email'?'이메일 또는 비밀번호를 확인해주세요.':/PASSWORD/.test(payload.code||'')?'비밀번호를 확인해주세요. 새 비밀번호는 12~128자여야 해요.':path==='/sign-up/email'?'가입 정보를 확인해주세요. 이미 가입한 이메일이라면 로그인해주세요.':'요청을 완료하지 못했어요. 현재 비밀번호와 로그인 상태를 확인해주세요.';
  return json({error:payload.code||'authentication',message},result.status);
 }
 const response=json({ok:true,...(payload.user?{user:publicMember(payload.user)}:{})});
 for(const cookie of result.headers.getSetCookie())response.headers.append('Set-Cookie',cookie);
 return response;
}
export async function accountResponse(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/account')&&path!=='/api/member-notebook'&&!path.startsWith('/api/auth'))return null;
 try{
  // Only these wrappers are public: direct library signup would bypass consent validation.
  if(path.startsWith('/api/auth'))return json({error:'not_found'},404);
  if(!['GET','POST','PUT','DELETE'].includes(request.method))return json({error:'method'},405);
  if(request.method!=='GET')writeGuard(request,env.JIBRO_APP_ORIGIN);
  const auth=createAuth(env,ctx),db=env.DB;
  if(path==='/api/account'&&request.method==='GET'){
   const s=await auth.api.getSession({headers:request.headers}),testLoginAvailable=canUseTestAccount(request,env),user=s?.user&&(s.user.id!==TEST_USER_ID||testLoginAvailable)?s.user:null;
   if(user){try{const result=await migrateLegacyNotebooks(env);if(result.failed)console.error('Notebook encryption migration incomplete');}catch{console.error('Notebook encryption migration unavailable');}}
   return json({user:user?publicMember(user):null,testLoginAvailable,emailAvailable:mailAvailable(env),policyVersion:POLICY_VERSION});
  }
  if(['/api/account/request-password-reset','/api/account/send-verification'].includes(path)&&request.method==='POST'){
   requireMail(env);const data=await body(request),email=String(data.email||'').trim().toLowerCase();
   if(email===TEST_EMAIL||email==='admin')throw new HttpError(400,'test_account','테스트 계정은 이메일 인증·복구 대상이 아니에요.');
   return await authAction(auth,request,path.endsWith('request-password-reset')?'/request-password-reset':'/send-verification-email',{email});
  }
  if(path==='/api/account/reset-password'&&request.method==='POST'){
   const data=await body(request);
   return await authAction(auth,request,'/reset-password',{token:data.token,newPassword:data.newPassword});
  }
  if(path==='/api/account/verify-email'&&request.method==='POST'){
   const data=await body(request);if(typeof data.token!=='string'||data.token.length>2048)throw new HttpError(400,'invalid_token','올바른 인증 링크로 다시 시도해주세요.');
   const url=new URL('/api/auth/verify-email',env.JIBRO_APP_ORIGIN);url.searchParams.set('token',data.token);
   const result=await auth.handler(new Request(url,{headers:request.headers}));
   if(!result.ok)return json({error:'invalid_token',message:result.status===429?'시도가 많아요. 잠시 후 다시 시도해주세요.':'인증 링크가 만료되었거나 올바르지 않아요. 새 메일을 요청해주세요.'},result.status);
   return json({ok:true});
  }
  if(path==='/api/account/register'&&request.method==='POST'){
   const data=await body(request);
   if(String(data.email||'').trim().toLowerCase()===TEST_EMAIL)throw new HttpError(400,'reserved','다른 이메일로 가입해주세요.');
   if(data.terms!==true||data.privacy!==true||data.age!==true||data.policyVersion!==POLICY_VERSION)throw new HttpError(400,'consent','필수 동의 내용을 확인해주세요.');
   const applicantProfile=validatedApplicantProfile(data.applicantProfile);
   const cipher=applicantProfile?notebookCipher(env):null;
   const response=await authAction(auth,request,'/sign-up/email',{email:String(data.email||'').trim().toLowerCase(),password:data.password,name:signupNickname(data.nickname)});
   if(!response.ok||!applicantProfile)return response;
   const payload=await response.clone().json();
   try{const encrypted=await cipher.seal(payload.user.id,normalizeNotebook({name:payload.user.nickname,applicantProfile}));await db.prepare('INSERT INTO jibro_member_notebooks (user_id,payload,revision,updated_at) VALUES (?,?,1,?)').bind(payload.user.id,encrypted,new Date().toISOString()).run();return response;}
   catch{console.error('Initial applicant profile save failed');return new Response(JSON.stringify({...payload,profileSaved:false}),{status:response.status,headers:response.headers});}
  }
  if(path==='/api/account/login'&&request.method==='POST'){const data=await body(request);const email=await testLoginEmail(request,env,data);return await authAction(auth,request,'/sign-in/email',{email,password:data.password,rememberMe:true});}
  if(path==='/api/account/logout'&&request.method==='POST')return await authAction(auth,request,'/sign-out',{});
  if(path==='/api/account/password'&&request.method==='POST'){await requireMember(auth,request,env);const data=await body(request);return await authAction(auth,request,'/change-password',{currentPassword:data.currentPassword,newPassword:data.newPassword,revokeOtherSessions:true});}
  if(path==='/api/account'&&request.method==='DELETE'){
   await requireMember(auth,request,env);const data=await body(request);
   if(data.confirm!=='회원 탈퇴'||typeof data.password!=='string'||!data.password)throw new HttpError(400,'confirmation','현재 비밀번호와 탈퇴 확인 문구를 입력해주세요.');
   return await authAction(auth,request,'/delete-user',{password:data.password});
  }
  if(path==='/api/member-notebook'){
   const user=await requireMember(auth,request,env);
   if(request.method==='GET')return json(await readNotebook(env,user.id));
   if(request.method==='PUT'){
    const data=await body(request),revision=data.revision;
    if(!Number.isSafeInteger(revision)||revision<0)throw new HttpError(400,'revision','기록 버전을 확인해주세요.');
    const state=normalizeNotebook(data.state),now=new Date().toISOString();
    const encrypted=await notebookCipher(env).seal(user.id,state);
    const result=revision===0?await db.prepare('INSERT INTO jibro_member_notebooks (user_id,payload,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO NOTHING').bind(user.id,encrypted,now).run():await db.prepare('UPDATE jibro_member_notebooks SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(encrypted,now,user.id,revision).run();
    if(result.meta.changes!==1)throw new HttpError(409,'conflict','다른 창에서 기록이 변경됐어요. 새로고침 후 다시 시도해주세요.');
    return json({state,revision:revision+1});
   }
  }
  return json({error:'not_found',message:'요청한 기능을 찾을 수 없어요.'},404);
 }catch(error){if(!(error instanceof HttpError))console.error('Account request failed:',error.name);return json({error:error.code||'unavailable',message:error instanceof HttpError?error.message:'계정 정보를 처리하지 못했어요. 잠시 후 다시 시도해주세요.'},error.status||503);}
}
