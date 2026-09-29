import {build} from 'vite';
import {rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// Remove obsolete generated Worker bundles so they cannot be deployed accidentally.
for(const name of ['server','.openai']){
 const output=resolve(root,'dist',name);
 if(dirname(output)!==resolve(root,'dist'))throw Error('Invalid generated output path');
 await rm(output,{recursive:true,force:true});
}
await import('./build-notice-catalog.mjs');
await build({build:{outDir:'dist/client'}});
