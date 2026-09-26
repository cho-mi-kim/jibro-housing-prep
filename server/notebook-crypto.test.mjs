import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {notebookCipher,readNotebook,migrateLegacyNotebooks,ENCRYPTED_PREFIX} from './notebook-crypto.mjs';
import {localDatabase} from './local-d1.mjs';
const secret=()=>randomBytes(32).toString('base64url');
const settings=()=>({JIBRO_NOTEBOOK_KEYS:JSON.stringify({active:'first',keys:{first:secret()}})});
const state={name:'암호화 테스트',applicantProfile:{birthDate:'1995-03-27',monthlyIncome:3456789,totalAssets:98765432},noticeData:{one:{done:['서류']}}};
function seed(db,id,payload,revision=4){
 db.sqlite.prepare("INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at,terms_version,privacy_version,accepted_at) VALUES (?,?,?,0,0,0,'test','test','test')").run(id,'test',id+'@example.test');
 db.sqlite.prepare('INSERT INTO jibro_member_notebooks VALUES (?,?,?,?)').run(id,payload,revision,'original-time');
}
test('AES-GCM round trip uses fresh nonces and contains no plaintext profile or notebook fields',async()=>{
 const cipher=notebookCipher(settings()),a=await cipher.seal('member-one',state),b=await cipher.seal('member-one',state);
 assert.notEqual(a,b);assert.ok(a.startsWith(ENCRYPTED_PREFIX));
 for(const text of ['birthDate','1995-03-27','monthlyIncome','3456789','98765432','암호화 테스트'])assert.ok(!a.includes(text));
 assert.deepEqual(await cipher.open('member-one',a),{state,rewrite:false});
});
test('another member, a different key, changed ciphertext, IV or key id cannot decrypt',async()=>{
 const cipher=notebookCipher(settings()),encrypted=await cipher.seal('member-one',state);
 await assert.rejects(cipher.open('member-two',encrypted));
 await assert.rejects(notebookCipher(settings()).open('member-one',encrypted));
 const parts=encrypted.split(':');
 for(const index of [4,5]){const changed=[...parts];changed[index]=(changed[index][0]==='A'?'B':'A')+changed[index].slice(1);await assert.rejects(cipher.open('member-one',changed.join(':')));}
 await assert.rejects(cipher.open('member-one',encrypted.replace(':first:',':missing:')));
 await assert.rejects(cipher.open('member-one',encrypted.replace(':v1:',':v2:')));
 await assert.rejects(cipher.open('member-one',encrypted+':extra'));
});
test('configuration errors fail closed, including absent, short, unknown or malformed keys',()=>{
 for(const value of [undefined,'{}','invalid',JSON.stringify({active:'first',keys:{first:'short'}}),JSON.stringify({active:'unknown',keys:{first:secret()}})])assert.throws(()=>notebookCipher({JIBRO_NOTEBOOK_KEYS:value}));
});
test('active-key rotation reads old ciphertext and rewrites on member read without changing revision',async()=>{
 const env={...settings(),DB:localDatabase()};try{
  const old=notebookCipher(env),encrypted=await old.seal('one',state);seed(env.DB,'one',encrypted);
  const config=JSON.parse(env.JIBRO_NOTEBOOK_KEYS);config.active='second';config.keys.second=secret();env.JIBRO_NOTEBOOK_KEYS=JSON.stringify(config);
  assert.deepEqual(await notebookCipher(env).open('one',encrypted),{state,rewrite:true});
  assert.deepEqual(await readNotebook(env,'one'),{state,revision:4});
  const row=env.DB.sqlite.prepare('SELECT * FROM jibro_member_notebooks').get();assert.ok(row.payload.startsWith(ENCRYPTED_PREFIX+'second:'));assert.equal(row.updated_at,'original-time');
  delete config.keys.first;env.JIBRO_NOTEBOOK_KEYS=JSON.stringify(config);assert.deepEqual((await readNotebook(env,'one')).state,state);
 }finally{env.DB.sqlite.close();}
});
test('bounded legacy backfill is idempotent and keeps all account records and metadata intact',async()=>{
 const env={...settings(),DB:localDatabase()};try{
  for(let i=0;i<27;i++)seed(env.DB,'user-'+String(i).padStart(2,'0'),JSON.stringify({...state,index:i}));
  assert.deepEqual(await migrateLegacyNotebooks(env),{scanned:25,migrated:25,failed:0});
  assert.deepEqual(await migrateLegacyNotebooks(env),{scanned:2,migrated:2,failed:0});
  assert.deepEqual(await migrateLegacyNotebooks(env),{scanned:0,migrated:0,failed:0});
  for(const row of env.DB.sqlite.prepare('SELECT * FROM jibro_member_notebooks').all()){
   assert.equal(row.revision,4);assert.equal(row.updated_at,'original-time');assert.ok(row.payload.startsWith(ENCRYPTED_PREFIX));
   assert.deepEqual((await notebookCipher(env).open(row.user_id,row.payload)).state,{...state,index:Number(row.user_id.slice(5))});
  }
 }finally{env.DB.sqlite.close();}
});
test('legacy read and migration compare-and-swap cannot overwrite a simultaneous save',async()=>{
 for(const operation of [env=>readNotebook(env,'one'),migrateLegacyNotebooks]){
  const env={...settings(),DB:localDatabase()};try{
   seed(env.DB,'one',JSON.stringify(state));const newer=await notebookCipher(env).seal('one',{...state,name:'newer'}),prepare=env.DB.prepare;
   env.DB.prepare=sql=>{if(sql.startsWith('UPDATE jibro_member_notebooks SET payload = ? WHERE'))env.DB.sqlite.prepare('UPDATE jibro_member_notebooks SET payload=?,revision=5 WHERE user_id=?').run(newer,'one');return prepare(sql);};
   await operation(env);const stored=env.DB.sqlite.prepare('SELECT * FROM jibro_member_notebooks').get();assert.equal(stored.revision,5);assert.equal(stored.payload,newer);
  }finally{env.DB.sqlite.close();}
 }
});
test('corrupt legacy rows are preserved and reported while valid rows can still migrate',async()=>{
 const env={...settings(),DB:localDatabase()};try{
  seed(env.DB,'broken','{not-json');seed(env.DB,'valid',JSON.stringify(state));
  assert.deepEqual(await migrateLegacyNotebooks(env),{scanned:2,migrated:1,failed:1});
  assert.equal(env.DB.sqlite.prepare('SELECT payload FROM jibro_member_notebooks WHERE user_id=?').get('broken').payload,'{not-json');
  await assert.rejects(readNotebook(env,'broken'));
 }finally{env.DB.sqlite.close();}
});
