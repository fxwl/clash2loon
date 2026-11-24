import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const names = [
  "中國台灣-TW-01·台南",
  "中國台灣-TW-02·台南",
  "中國台灣-TW-03·台南",
  "中國台灣-TW-04·台南",
  "中國台灣-TW-06·台南",
  "中國台灣-TW-07·台南",
  "中國台灣-TW-08·台南",
  "中國台灣-TW-09·台南",
  "中國台灣-TW-10·台南",
  "中國台灣-TW-11·台南",
  "中國台灣-TW-12·台南",
  "中國台灣-TW-13·台南",
  "中國台灣-TW-14·台南",
  "中國台灣-TW-15·台南",
  "中國台灣-TW-16·台南",
  "中國台灣-TW-17·台南",
  "中國台灣-TW-19·台南",
  "中國台灣-TW-20·台南",
  "中國台灣-TW-21·台南",
  "中國台灣-TW-23·台南",
  "中國台灣-TW-24·台南",
  "中國台灣-TW-25·台南",
  "中國台灣-TW-32·台南",
  "中國台灣-TW-78·台南",
  "中國台灣-TW-79·台南",
  "中國台灣-TW-85·台南",
  "中國台灣-TW-89·台南",
  "中國台灣-TW-91·台南",
  "中國台灣-TW-92·台南",
  "中國台灣-TW-93·台南",
  "中國台灣-TW-96·台南",
  "中國台灣-TW-87·台南",
  "中國台灣-TW-94·台南"
];
const shared = {
  type: 'vless',
  server: '152.175.13.53',
  uuid: 'c8788f87-3822-47a0-a654-3dbec05f74dc',
  network: 'tcp',
  udp: true,
  tls: true,
  servername: 'www.apple.com',
  'client-fingerprint': 'chrome',
  'reality-opts': {
    'public-key': 'EVKY5IWYIrGXh113-npkzPhmS-PAM44LXxE23B1Awlw',
    'short-id': '0a32d33f'
  }
};

const proxies = names.map((name, index) => ({
  name,
  ...shared,
  port: 21000 + index
}));

const clash = {
  proxies,
  'proxy-groups': [{
    name: '🇹🇭 台湾家宽',
    type: 'url-test',
    proxies: names,
    url: 'https://www.gstatic.com/generate_204',
    interval: 300,
    lazy: false
  }],
  'rule-providers': {},
  rules: ['MATCH,🇹🇭 台湾家宽']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery'
});

assert.equal(out.stats.convertedNodes, names.length);
for (const name of names) {
  assert.ok(out.nodes.includes(`${name} = VLESS,`), `/nodes lost ${name}`);
}

const groupLine = out.config.split('\n').find(line => line.startsWith('🇹🇭 台湾家宽 = url-test,'));
assert.ok(groupLine, 'static Taiwan home group missing');

for (const name of names) {
  assert.ok(out.nodes.includes(`${name} = VLESS,`), `/nodes lost ${name}`);
  assert.ok(!out.config.includes(`${name} = VLESS,`), `main config unexpectedly inlined ${name}`);
  assert.ok(!groupLine.includes(name), `linked policy group must not reference remote node name directly: ${name}`);
}

assert.ok(out.config.includes('[Remote Proxy]'), 'linked mode must emit Remote Proxy');
assert.ok(out.config.includes('C2L_Nodes = https://example.workers.dev/nodes?token=TEST_TOKEN'));
assert.ok(out.config.includes('[Remote Filter]'));
assert.equal(out.stats.nodeDelivery, 'remote-proxy');
assert.ok(out.stats.remoteFilters > 0);
assert.ok(Array.isArray(out.stats.groupDiagnostics), 'group diagnostics missing');
const groupDiagnostic = out.stats.groupDiagnostics.find(item => item.name === '🇹🇭 台湾家宽');
assert.ok(groupDiagnostic, 'Taiwan home diagnostic missing');
assert.equal(groupDiagnostic.sourceMembers, names.length);
assert.ok(groupDiagnostic.emittedMembers >= 1 && groupDiagnostic.emittedMembers < names.length);
assert.equal(groupDiagnostic.compressedNodeMembers, names.length);
assert.ok(groupDiagnostic.filterRefs >= 1);
assert.equal(groupDiagnostic.compactionMode, 'remote-filter');
assert.equal(groupDiagnostic.missingMembers.length, 0);
assert.equal(groupDiagnostic.lineBytes, new TextEncoder().encode(groupLine).length);
assert.equal(out.stats.maxProxyGroupLineBytes, groupDiagnostic.lineBytes);
assert.ok(groupLine.includes('C2L_NodeSet_'));
assert.match(groupLine, /interval=7200/, 'battery home-group interval should be 7200 seconds');
assert.ok(out.stats.maxLineBytes < 2048, `Taiwan group line unexpectedly large: ${out.stats.maxLineBytes}`);

console.log(JSON.stringify({
  ok: true,
  group: '🇹🇭 台湾家宽',
  nodes: names.length,
  nodeDelivery: out.stats.nodeDelivery,
  remoteFilters: out.stats.remoteFilters,
  interval: 7200,
  maxLineBytes: out.stats.maxLineBytes
}, null, 2));
