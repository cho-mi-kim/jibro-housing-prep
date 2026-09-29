import {verifyPassword} from 'better-auth/crypto';
import {HttpError} from './notebook.mjs';
export const TEST_USER_ID='site-test-admin';
export const TEST_EMAIL='admin@jibro.test';
// Only enable this account on an owner-private Site: the Sites access policy
// protects every request before it reaches this Worker. Site user IDs are not
// workspace account IDs, and forwarded display email is not an authorization key.
// Disable the test scope before expanding the Site audience or moving hosts.
export function canUseTestAccount(request,env){
 return env.JIBRO_TEST_LOGIN_ENABLED==='1'
  &&env.JIBRO_TEST_LOGIN_SCOPE==='owner-private-site'
  &&!!env.JIBRO_TEST_PASSWORD_HASH
  &&new URL(request.url).origin===env.JIBRO_APP_ORIGIN;
}
export async function testLoginEmail(request,env,data){
 const email=String(data.email||'').trim().toLowerCase();
 if(!['admin',TEST_EMAIL].includes(email))return email;
 if(!canUseTestAccount(request,env))throw new HttpError(401,'credentials','이메일 또는 비밀번호를 확인해주세요.');
 const existing=await env.DB.prepare('SELECT id FROM auth_account WHERE user_id = ? AND provider_id = ?').bind(TEST_USER_ID,'credential').first();
 if(!existing){
  // Failed credentials still pass through Better Auth's persistent rate limiter.
  if(typeof data.password!=='string'||data.password.length>128||!await verifyPassword({hash:env.JIBRO_TEST_PASSWORD_HASH,password:data.password}))return TEST_EMAIL;
  const now=Date.now();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at,terms_version,privacy_version,accepted_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(TEST_USER_ID,'관리자 (테스트)',TEST_EMAIL,0,now,now,'owner-test','owner-test',new Date(now).toISOString()),
   env.DB.prepare('INSERT INTO auth_account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('site-test-admin-password',TEST_USER_ID,'credential',TEST_USER_ID,env.JIBRO_TEST_PASSWORD_HASH,now,now)
  ]);
 }
 return TEST_EMAIL;
}
