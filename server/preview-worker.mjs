// Local preview entry only. The production build uses worker.mjs and never imports this.
import worker from './worker.mjs';
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(env.JIBRO_LOCAL_PREVIEW==='1'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.pathname==='/api/account/login'&&request.method==='POST'){
  const data=await request.clone().json().catch(()=>null);
  if(typeof data?.email==='string'&&data.email.trim().toLowerCase()==='admin'){
   const headers=new Headers(request.headers);headers.delete('content-length');
   request=new Request(request.url,{method:'POST',headers,body:JSON.stringify({...data,email:'admin@jibro.local.test'})});
  }
 }
 return worker.fetch(request,env,ctx);
}};
