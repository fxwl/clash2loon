import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const names = [
  'HK-01 0.20x',
  'SG-01 0.2x',
  'JP-01 0.2x',
  'TW-01 0.2x',
  'US-01 0.2x',
  'Tokyo-Edge-01 0.1x | ISP'
];

const proxies = names.map((name, index) => ({
  name,
  type: 'trojan',
  server: `node${index + 1}.example.com`,
  port: 443,
  password: `password-${index + 1}`,
  sni: 'example.com',
  udp: true
}));

const clash = {
  proxies,
  'proxy-groups': [
    { name: 'Main Proxy', type: 'select', proxies: ['Auto', 'Low Rate', 'Budget', ...names] },
    { name: 'Auto', type: 'url-test', proxies: names, url: 'https://www.gstatic.com/generate_204', interval: 300 },
    { name: 'Budget', type: 'url-test', proxies: names.slice(0, 5), url: 'https://www.gstatic.com/generate_204', interval: 300 },
    { name: 'Low Rate', type: 'url-test', proxies: names, url: 'https://www.gstatic.com/generate_204', interval: 300 }
  ],
  'rule-providers': {},
  rules: ['MATCH,Main Proxy']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery'
});

assert.ok(!out.config.includes('[Remote Proxy]'));
assert.ok(!out.config.includes('[Remote Filter]'));
assert.equal(out.stats.nodeDelivery, 'inline');
assert.equal(out.stats.remoteFilters, 0);

for (const name of names) {
  assert.ok(out.config.includes(`${name} = trojan,`), `[Proxy] lost inline node: ${name}`);
}

const selectLine = out.config.split('\n').find(v => v.startsWith('Main Proxy = select,'));
assert.equal(selectLine, `Main Proxy = select,Auto,Low Rate,Budget,${names.join(',')}`);

for (const groupName of ['Auto', 'Budget', 'Low Rate']) {
  const line = out.config.split('\n').find(v => v.startsWith(`${groupName} = `));
  assert.ok(line, `missing group: ${groupName}`);
  assert.ok(line.includes(names[0]));
}

assert.equal(out.stats.powerProfile, 'battery');

console.log(JSON.stringify({
  ok: true,
  remoteFilters: out.stats.remoteFilters,
  powerProfile: out.stats.powerProfile,
  inlineNodes: true
}, null, 2));
