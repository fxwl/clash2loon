import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const clash = {
  proxies: [
    { name: 'US-A', type: 'trojan', server: 'same.example.com', port: 443, password: 'same-password', sni: 'same.example.com', udp: true },
    { name: 'US-B', type: 'trojan', server: 'same.example.com', port: 443, password: 'same-password', sni: 'same.example.com', udp: true },
    { name: 'US-C', type: 'trojan', server: 'same.example.com', port: 443, password: 'same-password', sni: 'same.example.com', udp: false }
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
assert.ok(!nodeLines.some(line => line.startsWith('US-B = trojan,')));
assert.ok(nodeLines.some(line => line.startsWith('US-C = trojan,')));

const manual = out.config.split('\n').find(line => line.startsWith('Manual = select,'));
assert.equal(manual, 'Manual = select,US-A,US-C');

const auto = out.config.split('\n').find(line => line.startsWith('Auto = url-test,'));
assert.ok(auto?.startsWith('Auto = url-test,US-A,US-C,'));
assert.match(auto, /interval=10800/);

assert.ok(!out.config.includes('US-A = trojan,'));
assert.ok(!out.config.includes('US-C = trojan,'));
assert.ok(!out.config.includes('US-B = trojan,'));
assert.ok(out.config.includes('[Remote Proxy]'));
assert.ok(!out.config.includes('[Remote Filter]'));
assert.equal(out.stats.nodeDelivery, 'remote-proxy');
assert.equal(out.stats.remoteFilters, 0);

console.log(JSON.stringify({
  ok: true,
  sourceNodes: out.stats.sourceNodes,
  deduplicatedNodes: out.stats.deduplicatedNodes,
  duplicateNodesRemoved: out.stats.duplicateNodesRemoved,
  manual,
  auto
}, null, 2));
