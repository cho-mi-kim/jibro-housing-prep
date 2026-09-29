import {mailAvailable,scheduleAuthMail} from './mail.mjs';
import {betterAuth} from 'better-auth/minimal';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {drizzle} from 'drizzle-orm/d1';
import * as schema from '../db/schema.mjs';
export const POLICY_VERSION='2026-09-26';
export function createAuth(env,ctx){
 if(!env.DB||!env.JIBRO_AUTH_SECRET||!env.JIBRO_APP_ORIGIN)throw new Error('Account configuration unavailable');
 return betterAuth({
  appName:'JIBRO',baseURL:env.JIBRO_APP_ORIGIN,secret:env.JIBRO_AUTH_SECRET,basePath:'/api/auth',trustedOrigins:[env.JIBRO_APP_ORIGIN],
  database:drizzleAdapter(drizzle(env.DB,{schema}),{provider:'sqlite',schema,transaction:false}),
  emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,autoSignIn:true,requireEmailVerification:false,resetPasswordTokenExpiresIn:1800,revokeSessionsOnPasswordReset:true,...(mailAvailable(env)?{sendResetPassword:data=>scheduleAuthMail(env,ctx,data,'reset')}:{})},
  emailVerification:{expiresIn:1800,sendOnSignUp:mailAvailable(env),autoSignInAfterVerification:false,...(mailAvailable(env)?{sendVerificationEmail:data=>scheduleAuthMail(env,ctx,data,'verify')}:{})},
  session:{expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false}},
  user:{additionalFields:{termsVersion:{type:'string',input:false},privacyVersion:{type:'string',input:false},acceptedAt:{type:'string',input:false}},deleteUser:{enabled:true}},
  databaseHooks:{user:{create:{before:async data=>({data:{...data,termsVersion:POLICY_VERSION,privacyVersion:POLICY_VERSION,acceptedAt:new Date().toISOString()}})}}},
  rateLimit:{enabled:true,storage:'database',window:60,max:100,customRules:{'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:3600,max:10},'/change-password':{window:60,max:5},'/delete-user':{window:60,max:5},'/request-password-reset':{window:3600,max:5},'/send-verification-email':{window:3600,max:5},'/reset-password':{window:60,max:5},'/verify-email':{window:60,max:10}}},
  advanced:{useSecureCookies:env.JIBRO_APP_ORIGIN.startsWith('https:'),cookiePrefix:'jibro',ipAddress:{ipAddressHeaders:['cf-connecting-ip']},defaultCookieAttributes:{httpOnly:true,sameSite:'lax'}},
  logger:{level:'error'},telemetry:{enabled:false}
 });
}
