import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const shared = {
  type: 'trojan',
  server: 'example.com',
  port: 443,
  password: 'test-password',
  sni: 'example.com',
  udp: true
};

const tw01 = 'TW-01';
const tw02 = 'TW-02';
const tw05 = 'TW-05';
const india = 'IN-01';
const unsupported = 'TW-99-UNSUPPORTED';

const clash = {
  proxies: [
    { name: india, ...shared, server: 'in.example.com' },
    { name: tw01, ...shared, server: 'tw1.example.com' },
    { name: tw02, ...shared, server: 'tw2.example.com' },
    { name: tw05, ...shared, server: 'tw5.example.com' },
    { name: unsupported, type: 'ss', server: '198.51.100.9', port: 8388, cipher: 'aes-128-gcm', password: 'test' }
  ],
  'proxy-groups': [{
    name: 'Taiwan Auto',
    type: 'url-test',
    'include-all': true,
    filter: '(?i)^TW-',
    'exclude-filter': 'TW-02',
    url: 'https://www.gstatic.com/generate_204',
    interval: 300
  }],
  'rule-providers': {},
  rules: ['MATCH,Taiwan Auto']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery'
});

assert.ok(out.nodes.includes(`${tw05} = trojan,`));
assert.ok(!out.nodes.includes(`${unsupported} =`));
assert.ok(out.warnings.some(w => w.code === 'PROXY_TYPE_UNSUPPORTED' && w.node === unsupported));

const groupLine = out.config.split('\n').find(line => line.startsWith('Taiwan Auto = url-test,'));
assert.ok(groupLine);
assert.ok(groupLine.includes(tw01));
assert.ok(groupLine.includes(tw05));
assert.ok(!groupLine.includes(tw02));
assert.ok(!groupLine.includes(india));
assert.ok(!groupLine.includes(unsupported));
assert.ok(out.config.includes('[Remote Proxy]'));
assert.ok(!out.config.includes('[Remote Filter]'));
assert.equal(out.stats.nodeDelivery, 'remote-proxy');

assert.equal(out.stats.dynamicGroupsExpanded, 1);
const expansion = out.stats.dynamicGroupExpansions.find(item => item.group === 'Taiwan Auto');
assert.ok(expansion);
assert.equal(expansion.added, 2);
assert.equal(expansion.filter, '(?i)^TW-');
assert.equal(expansion.excludeFilter, 'TW-02');

console.log(JSON.stringify({
  ok: true,
  group: expansion.group,
  added: expansion.added,
  convertedNodes: out.stats.convertedNodes
}, null, 2));
