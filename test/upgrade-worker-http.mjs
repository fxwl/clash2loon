import assert from 'node:assert/strict';
import worker from '../src/index.js';
const proxies=Array.from({length:501},(_,i)=>({name:'HTTP-'+i,type:'http',server:'test'+i+'.example.com',port:8000+i}));
const config={proxies,'proxy-groups':[{name:'Group',type:'select',proxies:proxies.map(x=>x.name)}],
  'rule-providers':{Inline:{type:'inline',behavior:'domain',payload:['full:example.org','keyword:apple']}},
  rules:['RULE-SET,Inline,Group','MATCH,Group']};
let upstreamCalls=0;
globalThis.fetch=async (url)=>{
  if(String(url)!=='https://source.example/sub')throw new Error('Unexpected fetch (possible query source injection): '+url);
  upstreamCalls++;
  return new Response(JSON.stringify(config),{status:200,headers:{'content-type':'text/yaml','subscription-userinfo':'upload=1; download=2; total=3000'}});
};
const edgeCache = new Map();
globalThis.caches={default:{
  match:async request=>edgeCache.get(request.url)?.clone()||null,
  put:async (request,response)=>{edgeCache.set(request.url,response.clone());}
}};
const env={CLASH_URL:'https://source.example/sub',ACCESS_TOKEN:'TEST_TOKEN',CACHE_TTL:'0',RULE_CACHE_TTL:'0',POWER_PROFILE:'battery'};
const ctx={waitUntil:p=>{Promise.resolve(p).catch(()=>{});}};
const request=path=>new Request('https://worker.example'+path);
const response=await worker.fetch(request('/nodes?token=TEST_TOKEN'),env,ctx);
assert.equal(response.status,200);
const lines=(await response.text()).trim().split('\n');
assert.equal(lines.length,501);
assert.ok(lines[500].startsWith('HTTP-500 = http,'));
const paginated=await worker.fetch(request('/nodes?token=TEST_TOKEN&limit=50'),env,ctx);
assert.equal((await paginated.text()).trim().split('\n').length,50);
// A cold direct rule request may fallback to upstream once.
const cold=await worker.fetch(request('/rule/Inline?token=TEST_TOKEN'),env,ctx);
assert.equal(cold.status,200);
const main=await worker.fetch(request('/loon?token=TEST_TOKEN'),env,ctx);
assert.equal(main.status,200);
assert.ok((await main.text()).includes('[Remote Rule]'));
const callsAfterMain=upstreamCalls;
const rule=await worker.fetch(request('/rule/Inline?token=TEST_TOKEN&source=https://invalid.example'),env,ctx);
assert.equal(rule.status,200);
assert.equal(await rule.text(),'DOMAIN,example.org\nDOMAIN-KEYWORD,apple\n');
assert.equal(upstreamCalls,callsAfterMain,'Warm rule provider must not reload/parse upstream YAML');
const burst=await Promise.all(Array.from({length:30},(_,i)=>worker.fetch(request('/rule/Inline?token=TEST_TOKEN&burst='+i),env,ctx)));
assert.ok(burst.every(response=>response.status===200));
assert.equal(upstreamCalls,callsAfterMain,'Concurrent 30 rule fetches must reuse the trusted manifest');
const forbidden=await worker.fetch(request('/nodes'),env,ctx);
assert.equal(forbidden.status,401);
assert.ok(upstreamCalls>=3);
console.log(JSON.stringify({ok:true,remoteNodes:501,manualLimit:50,inlineProvider:true,auth:true,providerManifestWarm:true,parallelRuleRequests:30,upstreamCalls}));
