import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
await build({absWorkingDir:root,entryPoints:[path.join(root,'connected.js')],tsconfigRaw:{compilerOptions:{}},bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:path.join(root,'connected.bundle.js'),minify:true,logLevel:'info'});
