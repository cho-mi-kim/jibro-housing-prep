import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createServer} from 'node:net';
import {existsSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const win=process.platform==='win32';
const backend=resolve(root,'backend');
const serverEnv=join(backend,'.env.local');
if(existsSync(serverEnv))process.loadEnvFile(serverEnv);
// Never mistake an unrelated existing service for the child started below.
for(const port of [8080,5173])await new Promise((resolve,reject)=>{
 const probe=createServer();probe.once('error',()=>reject(Error(`${port} 포트가 사용 중입니다. 기존 실행을 먼저 종료해주세요.`)));
 probe.listen(port,'127.0.0.1',()=>probe.close(resolve));
});
const run=(command,args,cwd=root)=>spawn(command,args,{cwd,stdio:'inherit',env:process.env});
const compile=win?run(process.env.ComSpec||'cmd.exe',['/d','/s','/c','gradlew.bat bootJar --console=plain --no-daemon'],backend):run('sh',['./gradlew','bootJar','--console=plain','--no-daemon'],backend);
const built=await new Promise((resolve,reject)=>{compile.once('error',reject);compile.once('exit',resolve);});
if(built!==0)process.exit(built||1);
const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',win?'java.exe':'java'):'java';
const api=run(java,['-jar','build/libs/jibro-api.jar','--spring.profiles.active=local'],backend);
let web,stopping=false;
function stop(code=0){if(stopping)return;stopping=true;api.kill();web?.kill();process.exitCode=code;}
api.once('error',()=>{console.error('Java 17 실행 경로를 확인해주세요.');stop(1);});
api.once('exit',code=>{if(!stopping){console.error('Spring 서버가 종료됐습니다.');stop(code||1);}});
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
let ready=false;
for(let attempt=0;attempt<90&&!stopping;attempt++){
 try{const r=await fetch('http://127.0.0.1:8080/api/account',{signal:AbortSignal.timeout(1000)});if(r.ok){const d=await r.json();if(Object.hasOwn(d,'testLoginAvailable')){ready=true;break;}}}catch{}
 await new Promise(resolve=>setTimeout(resolve,1000));
}
if(!ready){console.error('Spring 서버를 시작하지 못했습니다. 위 오류와 8080 포트를 확인해주세요.');stop(1);}
else if(!stopping){web=run(process.execPath,['node_modules/vite/bin/vite.js']);web.once('error',()=>stop(1));web.once('exit',code=>stop(code||0));console.log('JIBRO React + Spring: http://127.0.0.1:5173 · 종료: Ctrl+C');}
