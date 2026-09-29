// Run against an offline D1 SQLite backup, never the live database.
import {DatabaseSync} from 'node:sqlite';
import {open} from 'node:fs/promises';
import {resolve} from 'node:path';
const [input,output]=process.argv.slice(2);
if(!input||!output||resolve(input)===resolve(output))throw Error('Usage: node scripts/export-legacy-members.mjs BACKUP.sqlite member-export.json');
const db=new DatabaseSync(resolve(input),{readOnly:true});
try{
 const data={format:'jibro-member-export-v1',users:db.prepare('SELECT id,name,email,email_verified,terms_version,privacy_version,accepted_at,created_at FROM auth_user ORDER BY id').all(),accounts:db.prepare("SELECT user_id,provider_id,password FROM auth_account WHERE provider_id='credential' ORDER BY user_id").all(),notebooks:db.prepare('SELECT user_id,payload,revision,updated_at FROM jibro_member_notebooks ORDER BY user_id').all()};
 const file=await open(resolve(output),'wx',0o600);
 try{await file.writeFile(JSON.stringify(data));await file.sync();}finally{await file.close();}
 console.log(`Offline export complete: ${data.users.length} members. Protect the file; it contains password hashes and encrypted records.`);
}finally{db.close();}
