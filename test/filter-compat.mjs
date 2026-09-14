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
    {
      name: 'Main Proxy',
      type: 'select',
      proxies: ['Auto', 'Low Rate', 'Budget', ...names]
    },
    {
      name: 'Auto',
      type: 'url-test',
      proxies: names,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300
    },
    {
      name: 'Budget',
      type: 'url-test',
      proxies: names.slice(0, 5),
      url: 'https://www.gstatic.com/generate_204',
      interval: 300
    },
    {
      name: 'Low Rate',
      type: 'url-test',
      proxies: names,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300
    }
  ],
  'rule-providers': {},
  rules: ['MATCH,Main Proxy']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery'
});

assert.match(
  out.config,
  /\[Remote Proxy\]\nC2L_Nodes = https:\/\/example\.workers\.dev\/nodes\?token=TEST_TOKEN,udp=true,enabled=true/
);
assert.ok(!out.config.includes('excludePinned'));
assert.ok(!out.config.includes('__C2L_'));
assert.ok(!out.config.includes('NameRegex,C2L_Nodes'));
assert.match(out.config, /C2L_NodeSet_[0-9a-f]{8}_1 = NameRegex, FilterKey = "/);

const selectLine = out.config.split('\n').find(v => v.startsWith('Main Proxy = select,'));
assert.ok(selectLine);
assert.match(
  selectLine,
  /^Main Proxy = select,Auto,Low Rate,Budget,C2L_NodeSet_[0-9a-f]{8}_1$/
);

for (const groupName of ['Auto', 'Budget', 'Low Rate']) {
  const line = out.config.split('\n').find(v => v.startsWith(`${groupName} = `));
  assert.ok(line);
  assert.match(line, /C2L_NodeSet_[0-9a-f]{8}_1/);
}

assert.ok(out.config.includes('HK-01 0\\.20x'));
assert.ok(out.config.includes('Tokyo-Edge-01 0\\.1x \\| ISP'));
assert.equal(out.stats.powerProfile, 'battery');

console.log(JSON.stringify({
  ok: true,
  remoteFilters: out.stats.remoteFilters,
  powerProfile: out.stats.powerProfile,
  orderedRemoteFilters: true,
  singleStableNodeSubscription: true
}, null, 2));
