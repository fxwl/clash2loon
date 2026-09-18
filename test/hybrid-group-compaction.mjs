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

assert.equal(out.stats.nodeDelivery, 'inline');
assert.equal(out.stats.groupCompactionMode, 'hybrid-local-filter');
assert.deepEqual(out.stats.groupCompactionThresholds, { members: 64, lineBytes: 2048 });
assert.equal(out.stats.compressedGroups, 3);
assert.equal(out.stats.uniqueNodeSets, 1);
assert.equal(out.stats.remoteFilters, 6);
assert.equal(out.stats.compressedNodeReferences, 192 * 3);

assert.ok(out.config.includes('[Remote Filter]'));
assert.ok(!out.config.includes('[Remote Proxy]'));

const filterLines = out.config.split('\n').filter(line => line.startsWith('C2L_NodeSet_'));
assert.equal(filterLines.length, 6);
for (const line of filterLines) {
  assert.match(line, /^C2L_NodeSet_[a-f0-9]+_\d+ = NameRegex,FilterKey="/);
  assert.ok(!line.includes('C2L_Nodes'));
  assert.ok(new TextEncoder().encode(line).length < 1400);
}

for (const name of names) {
  assert.ok(out.config.includes(`${name} = trojan,`), `[Proxy] lost ${name}`);
}

function diagnostic(name) {
  const item = out.stats.groupDiagnostics.find(value => value.name === name);
  assert.ok(item, `missing diagnostics for ${name}`);
  return item;
}

for (const name of ['Main Select', 'Auto', 'AI']) {
  const item = diagnostic(name);
  assert.equal(item.compactionMode, 'local-filter');
  assert.equal(item.compressedNodeMembers, 192);
  assert.equal(item.filterRefs, 6);
  assert.ok(item.lineBytes < 512);
  assert.equal(item.missingMembers.length, 0);
}

const small = diagnostic('Small Group');
assert.equal(small.sourceMembers, 33);
assert.equal(small.emittedMembers, 33);
assert.equal(small.compactionMode, 'inline');
assert.ok(small.lineBytes < 2048);

const reversed = diagnostic('Custom Reverse');
assert.equal(reversed.sourceMembers, 192);
assert.equal(reversed.emittedMembers, 192);
assert.equal(reversed.compactionMode, 'inline');
assert.ok(reversed.lineBytes > 2048);

const fallback = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery',
  groupCompaction: false
});
assert.equal(fallback.stats.groupCompactionMode, 'inline-fallback');
assert.equal(fallback.stats.compressedGroups, 0);
assert.equal(fallback.stats.remoteFilters, 0);
assert.ok(!fallback.config.includes('[Remote Filter]'));
assert.ok(!fallback.config.includes('[Remote Proxy]'));
const fallbackMain = fallback.config.split('\n').find(line => line.startsWith('Main Select = select,'));
assert.ok(fallbackMain);
for (const name of names) assert.ok(fallbackMain.includes(name));

console.log(JSON.stringify({
  ok: true,
  compressedGroups: out.stats.compressedGroups,
  remoteFilters: out.stats.remoteFilters,
  mainLineBytes: diagnostic('Main Select').lineBytes,
  smallLineBytes: small.lineBytes,
  reversePreservedInline: true,
  fallbackInline: true
}, null, 2));
