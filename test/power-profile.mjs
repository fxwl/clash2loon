import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const clash = {
  proxies: [
    {
      name: 'US01',
      type: 'trojan',
      server: 'example.com',
      port: 443,
      password: 'test-password',
      sni: 'example.com',
      udp: true
    }
  ],
  'proxy-groups': [
    { name: '⚡ 自动选择', type: 'url-test', proxies: ['US01'], url: 'https://www.gstatic.com/generate_204', interval: 300 },
    { name: '🇺🇸 美国', type: 'url-test', proxies: ['US01'], url: 'https://www.gstatic.com/generate_204', interval: 300 },
    { name: '👻 低倍率组', type: 'url-test', proxies: ['US01'], url: 'https://www.gstatic.com/generate_204', interval: 300 },
    { name: '🔯 家宽', type: 'url-test', proxies: ['US01'], url: 'https://www.gstatic.com/generate_204', interval: 300 },
    { name: 'Other Auto', type: 'url-test', proxies: ['US01'], url: 'https://www.gstatic.com/generate_204', interval: 300 }
  ],
  'rule-providers': {},
  rules: ['MATCH,⚡ 自动选择']
};

function convert(powerProfile) {
  return convertClashToLoon(clash, {
    baseUrl: 'https://example.workers.dev',
    token: 'TEST_TOKEN',
    powerProfile
  });
}

function intervalFor(out, groupName) {
  const line = out.config.split('\n').find(v => v.startsWith(`${groupName} = url-test,`));
  assert.ok(line, `missing url-test group: ${groupName}`);
  const match = line.match(/(?:^|,)interval=(\d+)(?:,|$)/);
  assert.ok(match, `missing interval in group: ${groupName}`);
  return Number(match[1]);
}

const source = convert('source');
for (const name of ['⚡ 自动选择', '🇺🇸 美国', '👻 低倍率组', '🔯 家宽', 'Other Auto']) {
  assert.equal(intervalFor(source, name), 300);
}
assert.equal(source.stats.powerProfile, 'source');
assert.equal(source.stats.powerAdjustedGroups, 0);

const balanced = convert('balanced');
assert.equal(intervalFor(balanced, '⚡ 自动选择'), 600);
assert.equal(intervalFor(balanced, '🇺🇸 美国'), 900);
assert.equal(intervalFor(balanced, '👻 低倍率组'), 1800);
assert.equal(intervalFor(balanced, '🔯 家宽'), 600);
assert.equal(intervalFor(balanced, 'Other Auto'), 900);
assert.equal(balanced.stats.powerProfile, 'balanced');
assert.equal(balanced.stats.powerAdjustedGroups, 5);

const battery = convert('battery');
assert.equal(intervalFor(battery, '⚡ 自动选择'), 3600);
assert.equal(intervalFor(battery, '🇺🇸 美国'), 7200);
assert.equal(intervalFor(battery, '👻 低倍率组'), 14400);
assert.equal(intervalFor(battery, '🔯 家宽'), 7200);
assert.equal(intervalFor(battery, 'Other Auto'), 10800);
assert.equal(battery.stats.powerProfile, 'battery');
assert.equal(battery.stats.powerAdjustedGroups, 5);

const invalid = convert('invalid-profile');
assert.equal(invalid.stats.powerProfile, 'balanced');
assert.ok(invalid.warnings.some(w => w.code === 'POWER_PROFILE_INVALID'));

console.log(JSON.stringify({
  ok: true,
  source: source.stats.urlTestIntervals,
  balanced: balanced.stats.urlTestIntervals,
  battery: battery.stats.urlTestIntervals
}, null, 2));
