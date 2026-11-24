import {readFile,writeFile} from 'node:fs/promises';
let source=await readFile('src/index.js','utf8');
function replaceRange(before, after, replacement) {
  const a=source.indexOf(before),b=source.indexOf(after,a+before.length);
  if(a<0||b<0)throw Error('Missing function: '+before);
  source=source.slice(0,a)+replacement+'\n\n'+source.slice(b);
}
replaceRange('async function fetchBaseLoon(env) {','async function fetchUpstreamClash(env) {', [
'async function fetchBaseLoon(env) {',
'  if (!env.LOON_BASE_URL) return {body:EMBEDDED_LOON_BASE,source:"embedded",etag:"",lastModified:"",warning:null};',
'  try {',
'    const {body,response}=await fetchBounded(env.LOON_BASE_URL,{maxBytes:2*1024*1024,timeout:12000});',
'    return {body,source:"remote",etag:response.headers.get("etag")||"",lastModified:response.headers.get("last-modified")||"",warning:null};',
'  } catch(error) {',
'    return {body:EMBEDDED_LOON_BASE,source:"embedded-fallback",etag:"",lastModified:"",',
'      warning:{code:"LOON_BASE_FETCH_FAILED",detail:"Remote Base unavailable; embedded Loon Base was used."}};',
'  }',
'}'
].join('\n'));
replaceRange('async function fetchUpstreamClash(env) {','async function loadModel(request, env) {', [
'async function fetchUpstreamClash(env) {',
'  if (!env.CLASH_URL) throw Error("Missing CLASH_URL secret.");',
'  const {body,response}=await fetchBounded(env.CLASH_URL,{timeout:12000,maxBytes:5*1024*1024,',
'    headers:{"user-agent":"Clash2Loon-Worker/1.6.0","accept":"text/yaml,text/plain,*/*"}});',
'  return {body,subscriptionUserinfo:response.headers.get("subscription-userinfo")||"",',
'    etag:response.headers.get("etag")||"",lastModified:response.headers.get("last-modified")||""};',
'}'
].join('\n'));
// The public edition exposes configurable control-plane domains.
// Keep parseCsv while replacing the upstream fetch implementation.
if (!source.includes('function parseCsv(value) {')) {
  const target='async function loadModel(request, env) {';
  if (!source.includes(target)) throw Error('Missing loadModel for parseCsv');
  source=source.replace(target,
    "function parseCsv(value) {\\n  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);\\n}\\n\\n".replace(/\\n/g, '\n')+target);
}
const first=source.indexOf('async function fetchProviderSource('),last=source.indexOf('async function handleRule(',first);
if(first<0||last<0)throw Error('Missing provider function');
const provider=source.slice(first,last);
let revised=provider;
const start=revised.indexOf("    const r = await fetch(plan.url, {");
const end=revised.indexOf("    return {",start);
if(start<0||end<0)throw Error('Missing refetch branch');
revised=revised.slice(0,start)+'    const t=(await fetchBounded(plan.url,{maxBytes:5*1024*1024,timeout:12000})).body;\n'+revised.slice(end);
const start2=revised.indexOf("  const first = await fetch(provider.url, {");
const end2=revised.indexOf("  plan = convertProviderToLoon",start2);
if(start2<0||end2<0)throw Error('Missing source fetch');
revised=revised.slice(0,start2)+'  const firstText=(await fetchBounded(provider.url,{maxBytes:5*1024*1024,timeout:12000})).body;\n'+revised.slice(end2);
source=source.slice(0,first)+revised+source.slice(last);
await writeFile('src/index.js',source,'utf8');
console.log('Bounded sources and provider HTTP fetch applied.');
