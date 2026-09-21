import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const shared = {
  type: 'trojan',
  server: 'example.com',
  port: 443,
  password: 'x',
  sni: 'example.com',
  udp: true
};

const names = Array.from({ length: 192 }, (_, index) =>
  `POOL-${String(index + 1).padStart(3, '0')}-LongNodeName`
);
const proxies = names.map((name, index) => ({
  ...shared,
  name,
  server: `n${index}.example.com`
}));

const clash = {
  proxies,
  'proxy-groups': [
    { name: 'Main Select', type: 'select', proxies: ['Auto', 'DIRECT', 'REJECT', ...names] },
    { name: 'Auto', type: 'url-test', proxies: names, url: 'https://www.gstatic.com/generate_204', interval: 300 },
    { name: 'AI', type: 'select', proxies: ['Main Select', 'Auto', 'DIRECT', 'REJECT', ...names] },
    { name: 'Small Group', type: 'url-test', proxies: names.slice(0, 33), url: 'https://www.gstatic.com/generate_204', interval: 300 },
    { name: 'Custom Reverse', type: 'select', proxies: [...names].reverse() }
  ],
  'rule-providers': {},
  rules: ['MATCH,AI']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery'
});

assert.equal(out.stats.nodeDelivery, 'remote-proxy');
assert.equal(out.stats.groupCompactionMode, 'remote-filter-runs');
assert.deepEqual(out.stats.remoteFilterChunking, { maxNames: 36, maxRegexBytes: 1200 });
assert.equal(out.stats.compressedGroups, 4);
assert.equal(out.stats.filterBackedGroups, 5);
assert.ok(out.stats.uniqueNodeSets >= 3);
assert.ok(out.stats.remoteFilters > 6);
assert.equal(out.stats.compressedNodeReferences, 192 * 4 + 33);

assert.ok(out.config.includes('[Remote Filter]'));
assert.ok(out.config.includes('[Remote Proxy]'));
assert.ok(out.config.includes('C2L_Nodes = https://example.workers.dev/nodes?token=TEST_TOKEN'));

const filterLines = out.config.split('\n').filter(line => line.startsWith('C2L_NodeSet_'));
assert.equal(filterLines.length, out.stats.remoteFilters);
for (const line of filterLines) {
  assert.match(line, /^C2L_NodeSet_[a-f0-9]+_\d+ = NameRegex,C2L_Nodes,FilterKey="/);
  assert.ok(line.includes('C2L_Nodes'));

  assert.ok(new TextEncoder().encode(line).length < 1400);
}

for (const name of names) {
  assert.ok(out.nodes.includes(`${name} = trojan,`), `/nodes lost ${name}`);
  assert.ok(!out.config.includes(`${name} = trojan,`), `main config unexpectedly inlined ${name}`);
}

function diagnostic(name) {
  const item = out.stats.groupDiagnostics.find(value => value.name === name);
  assert.ok(item, `missing diagnostics for ${name}`);
  return item;
}

for (const name of ['Main Select', 'Auto', 'AI']) {
  const item = diagnostic(name);
  assert.equal(item.compactionMode, 'remote-filter');
  assert.equal(item.compressedNodeMembers, 192);
  assert.equal(item.filterRefs, 6);
  assert.ok(item.lineBytes < 512);
  assert.equal(item.missingMembers.length, 0);
}

const small = diagnostic('Small Group');
assert.equal(small.sourceMembers, 33);
assert.equal(small.compactionMode, 'remote-filter');
assert.equal(small.compressedNodeMembers, 33);
assert.equal(small.filterRefs, 1);
assert.equal(small.emittedMembers, 1);
assert.ok(small.lineBytes < 512);

const reversed = diagnostic('Custom Reverse');
assert.equal(reversed.sourceMembers, 192);
assert.equal(reversed.emittedMembers, 192);
assert.equal(reversed.compactionMode, 'remote-filter-exact');
assert.equal(reversed.compressedNodeMembers, 192);
assert.equal(reversed.filterRefs, 192);
assert.ok(reversed.lineBytes > 2048);

const fallback = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery',
  groupCompaction: false
});
assert.equal(fallback.stats.groupCompactionMode, 'remote-filter-exact');
assert.equal(fallback.stats.compressedGroups, 0);
assert.ok(fallback.stats.remoteFilters > 0);
assert.equal(fallback.stats.filterBackedGroups, 5);
assert.ok(fallback.config.includes('[Remote Filter]'));
assert.ok(fallback.config.includes('[Remote Proxy]'));
assert.equal(fallback.stats.nodeDelivery, 'remote-proxy');
const fallbackMain = fallback.config.split('\n').find(line => line.startsWith('Main Select = select,'));
assert.ok(fallbackMain);
assert.ok(fallbackMain.includes('C2L_NodeSet_'));
for (const name of names) assert.ok(!fallbackMain.includes(name));

console.log(JSON.stringify({
  ok: true,
  compressedGroups: out.stats.compressedGroups,
  remoteFilters: out.stats.remoteFilters,
  mainLineBytes: diagnostic('Main Select').lineBytes,
  smallLineBytes: small.lineBytes,
  reversePreservedByExactFilters: true,
  fallbackExactRemoteFilters: true
}, null, 2));
