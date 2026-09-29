import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {randomBytes} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'vite';
import {hashPassword} from 'better-auth/crypto';
const port=Number(process.env.PORT||5190),origin=`http://127.0.0.1:${port}`;
const notebookKeys=JSON.stringify({active:'local',keys:{local:randomBytes(32).toString('base64url')}});
await build({ssr:{noExternal:true,resolve:{conditions:['workerd','worker','module']}},build:{ssr:'server/preview-worker.mjs',outDir:'.sites-runtime/preview-server',copyPublicDir:false,rollupOptions:{output:{entryFileNames:'index.js',codeSplitting:false}}}});
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port,name:'jibro',modules:true,scriptPath:'.sites-runtime/preview-server/index.js',compatibilityDate:'2026-09-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'jibro-local'},assets:{directory:'dist/client',binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true}},bindings:{JIBRO_APP_ORIGIN:origin,JIBRO_AUTH_SECRET:randomBytes(48).toString('base64url'),JIBRO_NOTEBOOK_KEYS:notebookKeys,JIBRO_LOCAL_PREVIEW:'1'}}));
const db=await mf.getD1Database('DB');
for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
 const sql=await readFile('drizzle/'+name,'utf8');for(const statement of sql.split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(statement).run();
}
// This ordinary member is seeded only into the disposable local preview database.
// Signup keeps its 12-character minimum; production never receives this account.
const now=Date.now(),userId='local-preview-admin',passwordHash=await hashPassword('admin');
await db.batch([
 db.prepare('INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at,terms_version,privacy_version,accepted_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(userId,'관리자 (테스트)','admin@jibro.local.test',0,now,now,'local-test','local-test',new Date(now).toISOString()),
 db.prepare('INSERT INTO auth_account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind('local-preview-admin-password',userId,'credential',userId,passwordHash,now,now)
]);
console.log('Account preview ready: '+await mf.ready);
process.on('SIGINT',async()=>{await mf.dispose();process.exit(0)});
