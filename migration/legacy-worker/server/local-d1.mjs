// Local preview/test adapter only. Production uses the Sites D1 binding and migrations.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function localDatabase(filename=':memory:'){
 if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON');
 sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
  if(!sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)){sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name);}
 }
 const db={sqlite,prepare(sql){const statement=sqlite.prepare(sql);let values=[];return {bind(...v){values=v;return this;},async first(column){const row=statement.get(...values);return column?row?.[column]??null:row??null;},async all(){return {results:statement.all(...values),success:true,meta:{}};},async raw(){statement.setReturnArrays(true);return statement.all(...values);},async run(){const result=statement.run(...values);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}};},async batch(statements){return Promise.all(statements.map(s=>s.all()));}};
 return db;
}
