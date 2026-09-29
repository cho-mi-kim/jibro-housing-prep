import {build} from 'vite';
import {existsSync} from 'node:fs';
import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
await import('./build-notice-catalog.mjs');
const output=resolve('dist');
if(dirname(output)!==resolve(process.cwd()))throw new Error('Build output must stay inside the project');
await rm(output,{recursive:true,force:true});
await build({build:{outDir:'dist/client'}});
await build({ssr:{noExternal:true,resolve:{conditions:['workerd','worker','module']}},build:{ssr:'server/worker.mjs',outDir:'dist/server',copyPublicDir:false,rollupOptions:{output:{entryFileNames:'index.js',inlineDynamicImports:true}}}});
// GitHub checkouts do not contain a private Sites project binding.
// Keep both app bundles buildable without tying contributors to that Site.
if(existsSync('.openai/hosting.json')){
 await mkdir('dist/.openai',{recursive:true});
 await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
 await cp('drizzle','dist/.openai/drizzle',{recursive:true});
}
