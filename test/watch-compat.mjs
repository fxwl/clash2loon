import assert from 'node:assert/strict';
import { mergeLoonConfigs, parseLoonConfig } from '../src/base-merge.js';

const base = `
[General]
ip-mode = v4-only
ipv6-vif = off
skip-proxy = 192.168.0.0/16,localhost
bypass-tun = 10.0.0.0/8,192.168.0.0/16
real-ip = *.example.com
udp-fallback-mode = REJECT

[Plugin]

[Mitm]
hostname =
`;

const generated = `
[Proxy]

[Proxy Group]
Apple Services = select,DIRECT
Final = select,DIRECT

[Rule]
FINAL,Final
`;

const selfHost = 'worker.example.com';
const merged = mergeLoonConfigs(base, generated, { selfHost });
const parsed = parseLoonConfig(merged.config);
const general = parsed.sections.find(section => section.name.toLowerCase() === 'general');
assert.ok(general);

function setting(key) {
  const line = general.lines.find(value => value.trim().toLowerCase().startsWith(`${key.toLowerCase()} =`));
  assert.ok(line, `missing General setting: ${key}`);
  return line;
}

const apnsRanges = [
  '17.249.0.0/16',
  '17.252.0.0/16',
  '17.57.144.0/22',
  '17.188.128.0/18',
  '17.188.20.0/23'
];

const skipProxy = setting('skip-proxy');
const bypassTun = setting('bypass-tun');
const realIp = setting('real-ip');

for (const range of apnsRanges) {
  assert.ok(skipProxy.includes(range));
  assert.ok(bypassTun.includes(range));
}
for (const local of ['localhost', '*.local']) {
  assert.ok(skipProxy.includes(local));
  assert.ok(bypassTun.includes(local));
}

assert.ok(skipProxy.includes('192.168.0.0/16'));
assert.ok(bypassTun.includes('10.0.0.0/8'));
assert.ok(realIp.includes('*.example.com'));
assert.ok(realIp.includes('*.apple.com'));
assert.ok(realIp.includes('*.icloud.com'));
assert.ok(skipProxy.includes(selfHost));
assert.ok(bypassTun.includes(selfHost));
assert.ok(realIp.includes(selfHost));
assert.ok(!merged.config.includes('17.0.0.0/8'));
assert.ok(merged.config.includes('udp-fallback-mode = REJECT'));
assert.equal(merged.stats.appleWatchCompat, true);
assert.equal(merged.stats.appleApnsDirectRanges, 5);
assert.equal(merged.stats.selfHostBypass, true);
assert.equal(merged.stats.selfHost, selfHost);

console.log(JSON.stringify({
  ok: true,
  appleWatchCompat: true,
  appleApnsDirectRanges: 5,
  selfHostBypass: true,
  udpFallbackPreserved: true
}, null, 2));
