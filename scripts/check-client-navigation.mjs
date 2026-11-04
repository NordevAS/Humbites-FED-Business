import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {SourceTextModule,createContext} from 'node:vm';

// Regression for the observed Vinext beta.5 emitted Link namespace mismatch.
// This checks the real built/published code, without pretending to click in a browser.
const base=process.argv[2];
const sources=new Map();
async function read(url){
  if(sources.has(url))return sources.get(url);
  let code;
  if(url.startsWith('file:'))code=await readFile(fileURLToPath(url),'utf8');
  else{const response=await fetch(url);if(!response.ok||!response.headers.get('content-type')?.includes('javascript'))throw Error(`JavaScript unavailable: ${url} (${response.status})`);code=await response.text();}
  sources.set(url,code);return code;
}
async function visit(url){
  if(sources.has(url))return;
  const code=await read(url);
  const statics=new SourceTextModule(code,{identifier:url}).dependencySpecifiers;
  const dynamics=[...code.matchAll(/\bimport\(\s*(["'`])([^"'`]+)\1\s*\)/g)].map(x=>x[2]);
  const imports=[...new Set([...statics,...dynamics])].filter(x=>x.startsWith('.')||x.startsWith('/'));
  await Promise.all(imports.map(spec=>visit(new URL(spec,url).href)));
}
if(base){
  const response=await fetch(base);if(!response.ok)throw Error(`Page unavailable: ${response.status}`);const html=await response.text();
  const entries=[...html.matchAll(/<(?:script|link)\b[^>]*>/g)].flatMap(([tag])=>{
    if(tag.startsWith('<link')&&!/rel="modulepreload"/.test(tag))return[];
    const match=tag.match(/(?:src|href)="([^"]+)"/);return match?[new URL(match[1],base).href]:[];
  });
  if(!entries.length)throw Error('No client script/modulepreload entries found; refusing an empty green result.');
  await Promise.all(entries.map(visit));
}else{
  const directory=path.resolve('dist/client/_next/static/chunks');
  await Promise.all((await readdir(directory)).filter(name=>name.endsWith('.js')).map(name=>read(pathToFileURL(path.join(directory,name)).href)));
}
if(!sources.size)throw Error('No client modules found; refusing an empty green result.');
let inspected=0;
for(const [url,code]of [...sources]){
  // The static router also logs this message, but does not dynamically destructure
  // these named namespace exports. Only the reproduced Link seam is relevant.
  if(!code.includes('[vinext] RSC prefetch setup error:')||!code.includes('navigateClientSide')||!code.includes('getPrefetchInterceptionContext'))continue;
  // This is the compiled loader at the two reproduced browser stack locations.
  const loaders=[...code.matchAll(/import\((["'`])([^"'`]+)\1\)\.then\((\w+)=>\((\w+)=\3,\3\)\)/g)];
  if(!loaders.length)throw Error(`Unrecognized Vinext Link loader; inspect before claiming parity: ${url}`);
  for(const loader of loaders){
    const target=new URL(loader[2],url).href;const context=createContext({});const modules=new Map();
    async function load(id){if(modules.has(id))return modules.get(id);const pending=read(id).then(text=>new SourceTextModule(text,{context,identifier:id}));modules.set(id,pending);return pending;}
    const module=await load(target);await module.link((specifier,parent)=>load(new URL(specifier,parent.identifier).href));
    const exports=Object.getOwnPropertyNames(module.namespace);
    const missing=['navigateClientSide','getPrefetchInterceptionContext'].filter(name=>!exports.includes(name));inspected++;
    if(missing.length)throw Error(`Broken Link navigation namespace: ${path.basename(new URL(url).pathname)} imports ${path.basename(new URL(target).pathname)} but exports are missing ${missing.join(', ')}. This reproduces the deployed click/prefetch TypeErrors.`);
  }
}
console.log(`PASS: ${sources.size} ${base?'reachable':'built'} client modules checked; ${inspected} Vinext dynamic navigation namespaces verified; no observed broken Link edge. This is not whole-site/browser verification; clicks still require browser QA.`);
