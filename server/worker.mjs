import {accountResponse} from './account.mjs';
import {noticeSnapshotResponse} from './notice-snapshots.mjs';
import index from '../dist/client/index.html?raw';

export default {async fetch(request,env,ctx){
 const snapshot=noticeSnapshotResponse(request);if(snapshot)return snapshot;
 const response=await accountResponse(request,env,ctx);if(response)return response;
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return Response.json({error:'not_found'},{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(url.pathname==='/'||url.pathname==='/auth/complete')return new Response(request.method==='HEAD'?null:index,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
}};
