import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../backend/',import.meta.url));
const windows=process.platform==='win32';
const result=spawnSync(windows?(process.env.ComSpec||'cmd.exe'):'sh',windows?['/d','/s','/c','gradlew.bat test --tests "com.jibro.api.member.*" --console=plain --no-daemon']:['./gradlew','test','--tests','com.jibro.api.member.*','--console=plain','--no-daemon'],{cwd,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status??1);
