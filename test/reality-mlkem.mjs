import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const base = {
  type: 'vless',
  server: 'reality.example.com',
  port: 443,
  uuid: '11111111-2222-3333-4444-555555555555',
  network: 'tcp',
  flow: 'xtls-rprx-vision',
  tls: true,
  servername: 'jsdelivr.net',
  udp: true
};
const publicKey = 'TEST_REALITY_PUBLIC_KEY';
const mk = (name, fingerprint, hybrid, extra = {}) => ({
  ...base, name, 'client-fingerprint': fingerprint,
  'reality-opts': {
    'public-key': publicKey,
    'short-id': 'b6103e2ff7efa3',
    ...(hybrid === undefined ? {} : { 'support-x25519mlkem768': hybrid }),
    ...extra
  }
});
const proxies = [
  mk('Hybrid-Chrome', 'chrome', true, { '_spider-x': '/47140e6572cd690' }),
  mk('Legacy-Chrome', 'chrome', undefined),
  mk('Disabled-Chrome', 'chrome', false),
  mk('Disabled-String', 'chrome', 'false'),
  mk('Hybrid-Chrome-String', 'chrome', 'true'),
  mk('Hybrid-Safari', 'safari', true),
  mk('Hybrid-iOS', 'ios', true),
  mk('Hybrid-Chrome147', 'chrome147', true),
  mk('Hybrid-Unset', undefined, true)
];
const out = convertClashToLoon({
  proxies,
  'proxy-groups': [{ name: 'All', type: 'select', proxies: proxies.map(p => p.name) }],
  'rule-providers': {},
  rules: ['MATCH,All']
}, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'source'
});
function line(name) {
  const found = out.nodes.split('\n').find(v => v.startsWith(name + ' = VLESS,'));
  assert.ok(found, 'Missing converted node ' + name);
  return found;
}
for (const n of ['Hybrid-Chrome','Hybrid-Chrome-String','Hybrid-Chrome147','Hybrid-Unset']) {
  assert.ok(line(n).includes('tls-profile=chrome147'), n + ' must select hybrid Chrome');
}
for (const n of ['Hybrid-Safari','Hybrid-iOS']) {
  assert.ok(line(n).includes('tls-profile=safari-ios-26'), n + ' must select hybrid Safari');
}
for (const n of ['Legacy-Chrome','Disabled-Chrome','Disabled-String']) {
  assert.ok(line(n).includes('tls-profile=chrome'), n + ' must preserve legacy Chrome');
  assert.ok(!line(n).includes('tls-profile=chrome147'), n + ' must not force hybrid Chrome');
}
assert.ok(line('Hybrid-Chrome').includes('flow=xtls-rprx-vision'));
assert.ok(line('Hybrid-Chrome').includes('public-key="TEST_REALITY_PUBLIC_KEY"'));
assert.ok(line('Hybrid-Chrome').includes('short-id=b6103e2ff7efa3'));
assert.ok(line('Hybrid-Chrome').includes('over-tls=true'));
assert.ok(line('Hybrid-Chrome').includes('sni=jsdelivr.net'));
assert.ok(!line('Hybrid-Chrome').includes('support-x25519mlkem768'));
assert.ok(!line('Hybrid-Chrome').includes('spider-x='));
assert.ok(out.warnings.some(w => w.code === 'VLESS_REALITY_SPIDER_X_DROPPED' && w.node === 'Hybrid-Chrome'));
assert.ok(out.warnings.some(w => w.code === 'REALITY_MLKEM_TLS_PROFILE_MAPPED' && w.node === 'Hybrid-Chrome'));
assert.ok(!out.warnings.some(w => w.code === 'REALITY_MLKEM_TLS_PROFILE_MAPPED' && w.node === 'Legacy-Chrome'));
console.log(JSON.stringify({
  ok: true,
  hybridChrome: 'chrome147',
  hybridSafari: 'safari-ios-26',
  legacyChrome: 'chrome',
  numberOfProxies: proxies.length,
  mlkemMappingWarnings: out.warnings.filter(w => w.code === 'REALITY_MLKEM_TLS_PROFILE_MAPPED').length
}));
