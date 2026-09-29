import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {accountResponse} from './account.mjs';
import {localDatabase} from './local-d1.mjs';
import {mailAvailable,authMail,deliverAuthMail} from './mail.mjs';
import {createEmailVerificationToken} from 'better-auth/api';
const origin='https://jibro.example.test',password='Testing-password-123456';
function setup(){
 const env={DB:localDatabase(),JIBRO_APP_ORIGIN:origin,JIBRO_AUTH_SECRET:randomBytes(48).toString('base64url')},tasks=[];
 let cookie='';
 async function request(path,data,extra={}){
  const headers={Origin:origin,'X-Jibro-Request':'1','CF-Connecting-IP':'192.0.2.44','Content-Type':'application/json',Cookie:cookie,...extra};
  const r=await accountResponse(new Request(origin+path,{method:data?'POST':'GET',headers,...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil:p=>tasks.push(p)});
  if(r.headers.getSetCookie().length)cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  return {status:r.status,data:await r.json()};
 }
 return {env,tasks,request,enable(){env.JIBRO_RESEND_API_KEY='test-only-key';env.JIBRO_MAIL_FROM='account@example.test';},close(){env.DB.sqlite.close();}};
}
const signup={email:'member@example.test',password,nickname:'이메일 테스트',terms:true,privacy:true,age:true,policyVersion:'2026-09-26'};
test('mail transport requires configuration, sends no profile, rejects provider failures and uses fragment-only token links',async()=>{
 const env={JIBRO_APP_ORIGIN:origin};assert.equal(mailAvailable(env),false);
 await assert.rejects(deliverAuthMail(env,{},'reset'),/준비 중/);
 Object.assign(env,{JIBRO_RESEND_API_KEY:'test-only-key',JIBRO_MAIL_FROM:'account@example.test'});
 const data={user:{email:signup.email,name:'Should not be sent',profile:'private'},token:'secret-token'};
 const mail=authMail(env,data,'reset');assert.equal(JSON.stringify(mail).includes('private'),false);assert.equal(JSON.stringify(mail).includes('Should not'),false);
 const link=new URL(mail.text.match(/https:\/\/\S+/)[0]);assert.equal(link.pathname,'/auth/complete');assert.equal(link.search,'');assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'),'secret-token');
 await assert.rejects(deliverAuthMail(env,data,'reset',async()=>new Response('{}',{status:401})),/email_delivery_failed/);
 await deliverAuthMail(env,data,'verify',async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(options.redirect,'error');assert.equal(JSON.parse(options.body).to[0],signup.email);return Response.json({id:'mock-id'});});
});
test('without a sender signup/admin-compatible login remain available, email requests fail explicitly',async()=>{const t=setup();try{
 assert.equal((await t.request('/api/account')).data.emailAvailable,false);
 assert.equal((await t.request('/api/account/register',signup)).status,200);
 assert.equal((await t.request('/api/account')).data.user.emailVerified,false);
 assert.equal((await t.request('/api/account/request-password-reset',{email:signup.email})).status,503);
 assert.equal((await t.request('/api/account/send-verification',{email:signup.email})).status,503);
}finally{t.close();}});
test('verification requires explicit POST, keeps sessions separate and rejects expired/tampered tokens',async()=>{
 const t=setup(),oldFetch=globalThis.fetch,mails=[];globalThis.fetch=async(_,o)=>{mails.push(JSON.parse(o.body));return Response.json({id:'test-mail'});};
 try{t.enable();assert.equal((await t.request('/api/account/register',signup)).status,200);await Promise.all(t.tasks);assert.equal(mails.length,1);
  const link=new URL(mails[0].text.match(/https:\/\/\S+/)[0]),token=new URLSearchParams(link.hash.slice(1)).get('token');
  assert.equal((await t.request('/api/account')).data.user.emailVerified,false);
  assert.equal((await t.request('/api/account/verify-email',{token},{Origin:'https://other.test'})).status,403);
  assert.equal((await t.request('/api/account/verify-email',{token:'bad'})).status,401);
  const expired=await createEmailVerificationToken(t.env.JIBRO_AUTH_SECRET,signup.email,undefined,-1);
  assert.equal((await t.request('/api/account/verify-email',{token:expired})).status,401);
  assert.equal((await t.request('/api/account/verify-email',{token})).status,200);
  assert.equal((await t.request('/api/account')).data.user.emailVerified,true);
  assert.equal((await t.request('/api/auth/sign-up/email',signup)).status,404);
 }finally{globalThis.fetch=oldFetch;t.close();}
});
test('password reset hides account existence, expires once, rejects replay, and revokes sessions',async()=>{
 const t=setup(),oldFetch=globalThis.fetch,mails=[];globalThis.fetch=async(_,o)=>{mails.push(JSON.parse(o.body));return Response.json({id:'test-mail'});};
 try{
  await t.request('/api/account/register',signup);t.enable();
  const unknown=await t.request('/api/account/request-password-reset',{email:'nobody@example.test'}),known=await t.request('/api/account/request-password-reset',{email:signup.email});
  assert.deepEqual(unknown,known);assert.deepEqual(known.data,{ok:true});await Promise.all(t.tasks);assert.equal(mails.length,1);
  const token=new URLSearchParams(new URL(mails[0].text.match(/https:\/\/\S+/)[0]).hash.slice(1)).get('token');
  assert.equal((await t.request('/api/account/reset-password',{token,newPassword:'short'})).status,400);
  const next='Replacement-passphrase-9876';assert.equal((await t.request('/api/account/reset-password',{token,newPassword:next})).status,200);
  assert.equal((await t.request('/api/account')).data.user,null);
  assert.equal((await t.request('/api/account/reset-password',{token,newPassword:password})).status,400);
  assert.equal((await t.request('/api/account/login',{email:signup.email,password})).status,401);
  assert.equal((await t.request('/api/account/login',{email:signup.email,password:next})).status,200);
  await t.request('/api/account/request-password-reset',{email:signup.email});await Promise.all(t.tasks);
  const token2=new URLSearchParams(new URL(mails[1].text.match(/https:\/\/\S+/)[0]).hash.slice(1)).get('token');
  t.env.DB.sqlite.prepare('UPDATE auth_verification SET expires_at = ?').run(Date.now()-10000);
  assert.equal((await t.request('/api/account/reset-password',{token:token2,newPassword:password})).status,400);
  assert.equal((await t.request('/api/account/request-password-reset',{email:'admin'})).status,400);
 }finally{globalThis.fetch=oldFetch;t.close();}
});
