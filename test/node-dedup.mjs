import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const clash = {
  proxies: [
    {
      name: 'US-A',
      type: 'trojan',
      server: 'same.example.com',
      port: 443,
      password: 'same-password',
      sni: 'same.example.com',
      udp: true
    },
    {
      name: 'US-B',
      type: 'trojan',
      server: 'same.example.com',
      port: 443,
      password: 'same-password',
      sni: 'same.example.com',
      udp: true
    },
    {
      name: 'US-C',
      type: 'trojan',
      server: 'same.example.com',
      port: 443,
      password: 'same-password',
      sni: 'same.example.com',
      udp: false
    }
  ],
  'proxy-groups': [
    { name: 'Manual', type: 'select', proxies: ['US-B', 'US-A', 'US-C'] },
    { name: 'Auto', type: 'url-test', proxies: ['US-A', 'US-B', 'US-C'], url: 'https://www.gstatic.com/generate_204', interval: 300 }
  ],
  'rule-providers': {},
  rules: ['MATCH,Manual']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery'
});

assert.equal(out.stats.sourceNodes, 3);
assert.equal(out.stats.deduplicatedNodes, 2);
assert.equal(out.stats.duplicateNodesRemoved, 1);
assert.equal(out.stats.convertedNodes, 2);
assert.ok(out.warnings.some(w => w.code === 'DUPLICATE_NODES_REMOVED'));

const nodeLines = out.nodes.split('\n').filter(Boolean);
assert.equal(nodeLines.length, 2);
assert.ok(nodeLines.some(line => line.startsWith('US-A = trojan,')));
assert.ok(!nodeLines.some(line => line.startsWith('US-B = trojan,')), 'duplicate alias must not remain as a node definition');
assert.ok(nodeLines.some(line => line.startsWith('US-C = trojan,')), 'different UDP configuration must not be deduplicated');

const dedupFilter = out.config.split('\n').find(line =>
  /^C2L_NodeSet_[0-9a-f]{8}_1 = NameRegex, FilterKey = /.test(line) &&
  line.includes('US-A') && line.includes('US-C')
);
assert.ok(dedupFilter, 'deduplicated node set filter was not generated');
assert.ok(!dedupFilter.includes('US-B'), 'removed duplicate name must not remain in the generated filter');
const dedupFilterName = dedupFilter.slice(0, dedupFilter.indexOf(' = '));

const manual = out.config.split('\n').find(line => line.startsWith('Manual = select,'));
assert.equal(manual, `Manual = select,${dedupFilterName}`, 'manual group must point at the remapped deduplicated filter');

const auto = out.config.split('\n').find(line => line.startsWith('Auto = url-test,'));
assert.ok(auto);
assert.ok(auto.includes(dedupFilterName), 'identical deduplicated node set should reuse the same filter');
assert.match(auto, /interval=10800/, 'other battery url-test group should use a three-hour interval');
assert.ok(!out.config.includes('US-B = trojan,'));

console.log(JSON.stringify({
  ok: true,
  sourceNodes: out.stats.sourceNodes,
  deduplicatedNodes: out.stats.deduplicatedNodes,
  duplicateNodesRemoved: out.stats.duplicateNodesRemoved,
  dedupFilterName,
  manual,
  auto
}, null, 2));
