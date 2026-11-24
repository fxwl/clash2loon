import assert from 'node:assert/strict';
import { convertClashToLoon, normalizeRuleText } from '../src/converter.js';
import { parseInlineRule, normalizeProviderText, inlineProviderRules, resolveProxyProviders } from '../src/upgrade.js';

const ip=parseInlineRule('IP-CIDR,1.2.3.0/24,DIRECT,no-resolve');
assert.equal(ip.policy,'DIRECT');
assert.equal(ip.rule,'IP-CIDR,1.2.3.0/24,no-resolve');
assert.equal(parseInlineRule('DOMAIN,example.com,REJECT').policy,'REJECT');
assert.equal(parseInlineRule('PROCESS-NAME,App,PROXY'),null);
assert.equal(normalizeProviderText('full:example.org\nkeyword:apple\n+.example.com','domain'),'DOMAIN,example.org\nDOMAIN-KEYWORD,apple\nDOMAIN-SUFFIX,example.com\n');
const warnings=[];
assert.equal(normalizeProviderText('regexp:^abc\n+.example.com','domain',true,warnings),'DOMAIN-SUFFIX,example.com\n');
assert.ok(warnings.some(x=>x.code==='DOMAIN_PATTERN_UNSUPPORTED'));
assert.equal(inlineProviderRules({type:'inline',behavior:'ipcidr',payload:['1.2.3.0/24']}),'IP-CIDR,1.2.3.0/24,no-resolve\n');

const proxies=[
 {name:'SS',type:'ss',server:'ss.example.com',port:443,cipher:'aes-128-gcm',password:'secret'},
 {name:'SS-OBFS',type:'ss',server:'ss.example.com',port:443,cipher:'aes-128-gcm',password:'secret',plugin:'obfs', 'plugin-opts':{mode:'http',host:'example.com'}},
 {name:'SS-SHADOW',type:'ss',server:'ss.example.com',port:443,cipher:'aes-128-gcm',password:'secret',plugin:'shadow-tls','plugin-opts':{version:3,password:'shadow',host:'example.com'}},
 {name:'SSR',type:'ssr',server:'ssr.example.com',port:443,cipher:'aes-256-cfb',password:'secret',protocol:'origin',obfs:'plain'},
 {name:'HTTP',type:'http',server:'http.example.com',port:80,username:'u',password:'p'},
 {name:'HTTPS',type:'http',server:'https.example.com',port:443,tls:true,username:'u',password:'p'},
 {name:'WG',type:'wireguard',ip:'10.0.0.2', 'private-key':'test-private', peers:[{server:'wg.example.com',port:51820,'public-key':'test-public','allowed-ips':['0.0.0.0/0']}]},
 {name:'BAD-PLUGIN',type:'ss',server:'ss.example.com',port:443,cipher:'aes-128-gcm',password:'secret',plugin:'v2ray-plugin'}
];
const clash={proxies,'proxy-groups':[{name:'Manual',type:'select',proxies:proxies.map(x=>x.name)}],rules:['IP-CIDR,1.2.3.0/24,Manual,no-resolve','RULE-SET,Inline,Manual','MATCH,Manual'],
'rule-providers':{Inline:{type:'inline',behavior:'domain',payload:['full:test.example.com']}}};
const out=convertClashToLoon(clash,{baseUrl:'https://example.workers.dev',token:'TEST',powerProfile:'battery'});
assert.ok(out.nodes.includes('SS = Shadowsocks,'));
assert.ok(out.nodes.includes('SS-OBFS = Shadowsocks,'));
assert.ok(out.nodes.includes('SS-SHADOW = Shadowsocks,'));
assert.ok(out.nodes.includes('SSR = ShadowsocksR,'));
assert.ok(out.nodes.includes('HTTP = http,'));
assert.ok(out.nodes.includes('HTTPS = https,'));
assert.ok(out.nodes.includes('WG = WireGuard,'));
assert.ok(!out.nodes.includes('BAD-PLUGIN ='));
assert.ok(out.warnings.some(x=>x.code==='SS_PLUGIN_UNSUPPORTED'));
assert.ok(out.config.includes('policy=Manual'));
assert.ok(!out.config.includes('policy=no-resolve'));
assert.ok(out.config.includes('/rule/Inline?token=TEST'));
const resolved=await resolveProxyProviders({
 proxies:[{name:'existing',type:'http',server:'a.example.com',port:80}],
 'proxy-providers':{P:{type:'inline',payload:[{name:'added',type:'http',server:'b.example.com',port:80}]}},
 'proxy-groups':[{name:'Use',type:'select',use:['P'],proxies:['existing']}]
});
assert.deepEqual(resolved['proxy-groups'][0].proxies,['existing','added']);
assert.equal(resolved.proxies.length,2);
console.log('Public 1.6.3 compatibility fixtures passed');
