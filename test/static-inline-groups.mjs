import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const names = Array.from({ length: 33 }, (_, index) =>
  `TW-HOME-${String(index + 1).padStart(2, '0')}`
);
const proxies = names.map((name, index) => ({
  name,
  type: 'trojan',
  server: `tw-${index + 1}.example.com`,
  port: 443,
  password: `password-${index + 1}`,
  sni: 'example.com',
  udp: true
}));

const clash = {
  proxies,
  'proxy-groups': [{
    name: 'Taiwan Home',
    type: 'url-test',
    proxies: names,
    url: 'https://www.gstatic.com/generate_204',
    interval: 300,
    lazy: false
  }],
  'rule-providers': {},
  rules: ['MATCH,Taiwan Home']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery'
});

const groupLine = out.config.split('\n').find(line => line.startsWith('Taiwan Home = url-test,'));
assert.ok(groupLine);

for (const name of names) {
  assert.ok(out.nodes.includes(`${name} = trojan,`), `/nodes lost ${name}`);
  assert.ok(!out.config.includes(`${name} = trojan,`), `main config unexpectedly inlined ${name}`);
  assert.ok(groupLine.includes(name), `small group lost ${name}`);
}

assert.ok(out.config.includes('[Remote Proxy]'));
assert.ok(out.config.includes('C2L_Nodes = https://example.workers.dev/nodes?token=TEST_TOKEN'));
assert.ok(!out.config.includes('[Remote Filter]'));
assert.equal(out.stats.nodeDelivery, 'remote-proxy');
assert.equal(out.stats.remoteFilters, 0);

const diagnostic = out.stats.groupDiagnostics.find(item => item.name === 'Taiwan Home');
assert.ok(diagnostic);
assert.equal(diagnostic.sourceMembers, 33);
assert.equal(diagnostic.resolvedMembers, 33);
assert.equal(diagnostic.emittedMembers, 33);
assert.equal(diagnostic.compressedNodeMembers, 0);
assert.equal(diagnostic.filterRefs, 0);
assert.equal(diagnostic.compactionMode, 'inline');
assert.equal(diagnostic.missingMembers.length, 0);
assert.equal(diagnostic.lineBytes, new TextEncoder().encode(groupLine).length);
assert.ok(diagnostic.lineBytes < 2048);
assert.match(groupLine, /interval=10800/);

console.log(JSON.stringify({
  ok: true,
  group: diagnostic.name,
  sourceMembers: diagnostic.sourceMembers,
  lineBytes: diagnostic.lineBytes,
  compactionMode: diagnostic.compactionMode
}, null, 2));
