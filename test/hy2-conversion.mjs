import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const fingerprint = 'A1:'.repeat(31) + 'A1';
const proxies = [
  {
    name: 'HY2 Basic', type: 'hysteria2', server: 'basic.example.com', port: 443,
    password: 'simple', sni: 'basic.example.com'
  },
  {
    name: 'HY2 Only Ports', type: 'hysteria2', server: 'hopping.example.com',
    ports: '20000-20100', password: 'secret', sni: 'hopping.example.com',
    'hop-interval': '30s', down: '100 Mbps',
    obfs: 'salamander', 'obfs-password': 'salt'
  },
  {
    name: 'HY2 Port Override', type: 'hysteria2', server: 'override.example.com',
    port: 443, ports: '30000-30100', password: 'secret', 'hop-interval': 30
  },
  {
    name: 'HY2 Slash Alias', type: 'hy2', server: 'slash.example.com',
    ports: '20000-20050/25000', password: 'secret'
  },
  {
    name: 'HY2 Fingerprint', type: 'hysteria2', server: 'pin.example.com',
    port: 443, password: 'secret', fingerprint
  },
  {
    name: 'HY2 Orphan Obfs Password', type: 'hysteria2', server: 'orphan.example.com',
    port: 443, password: 'secret', 'obfs-password': 'not-enabled'
  },
  {
    name: 'HY2 Invalid Ports', type: 'hysteria2', server: 'invalid.example.com',
    port: 443, ports: '99999-100000', password: 'secret'
  },
  {
    name: 'HY2 Gecko', type: 'hysteria2', server: 'gecko.example.com',
    port: 443, password: 'secret', obfs: 'gecko', 'obfs-password': 'gecko'
  },
  {
    name: 'HY2 Missing Obfs Password', type: 'hysteria2', server: 'missing-obfs.example.com',
    port: 443, password: 'secret', obfs: 'salamander'
  },
  {
    name: 'HY2 Invalid Fingerprint', type: 'hysteria2', server: 'badpin.example.com',
    port: 443, password: 'secret', fingerprint: 'not-a-sha256'
  },
  {
    name: 'HY2 Invalid Password', type: 'hysteria2', server: 'nopass.example.com', port: 443
  },
  {
    name: 'HY2 Bad Hop Interval', type: 'hysteria2', server: 'badhop.example.com',
    port: 443, ports: '10000-10050', password: 'secret', 'hop-interval': '15-30'
  }
];

const model = convertClashToLoon({
  proxies,
  'proxy-groups': [{ name: 'Main', type: 'select', proxies: proxies.map(p => p.name) }],
  'rule-providers': {},
  rules: ['MATCH,Main']
}, { baseUrl: 'https://example.workers.dev', token: 'TEST', powerProfile: 'source' });

const lines = model.nodes.trim().split('\n');
const find = name => lines.find(line => line.startsWith(name + ' = '));
const warn = code => model.warnings.find(item => item.code === code);
assert.ok(find('HY2 Basic')?.startsWith('HY2 Basic = Hysteria2,basic.example.com,443,"simple"'));
assert.ok(find('HY2 Basic').includes('server-ports="443"'), 'Loon HY2 single-port compatibility');

const hopping = find('HY2 Only Ports');
assert.ok(hopping?.startsWith('HY2 Only Ports = Hysteria2,hopping.example.com,20000,"secret"'));
assert.ok(hopping.includes('server-ports="20000:20100"'));
assert.ok(hopping.includes('hop-interval=30'));
assert.ok(hopping.includes('download-bandwidth=100'));
assert.ok(hopping.includes('salamander-password="salt"'));

const override = find('HY2 Port Override');
assert.ok(override?.startsWith('HY2 Port Override = Hysteria2,override.example.com,30000,"secret"'));
assert.ok(override.includes('server-ports="30000:30100"'));

const alias = model.nodeEntries.find(item => item.name === 'HY2 Slash Alias');
assert.equal(alias?.subtype, 'hysteria2', 'hy2 aliases must be visible in /nodes?type=hysteria2');
assert.ok(alias.line.includes('server-ports="20000:20050,25000"'));
assert.ok(find('HY2 Fingerprint')?.includes('tls-cert-sha256=' + 'a1'.repeat(32)));
assert.ok(find('HY2 Orphan Obfs Password'));
assert.ok(!find('HY2 Orphan Obfs Password').includes('salamander-password='));
assert.ok(warn('HY2_OBFS_PASSWORD_IGNORED'));

for (const name of [
  'HY2 Invalid Ports', 'HY2 Gecko', 'HY2 Missing Obfs Password',
  'HY2 Invalid Fingerprint', 'HY2 Invalid Password'
]) {
  assert.equal(find(name), undefined, name + ' should be omitted rather than silently downgraded');
}
for (const code of [
  'HY2_PORTS_INVALID', 'HY2_OBFS_UNSUPPORTED', 'HY2_OBFS_PASSWORD_MISSING',
  'HY2_CERT_FINGERPRINT_INVALID', 'HY2_PASSWORD_MISSING',
  'HY2_HOP_INTERVAL_UNSUPPORTED'
]) assert.ok(warn(code), 'Missing expected diagnostic: ' + code);

assert.ok(find('HY2 Bad Hop Interval')?.includes('server-ports="10000:10050"'));
assert.ok(!find('HY2 Bad Hop Interval').includes('hop-interval='));
console.log(JSON.stringify({ ok: true, accepted: lines.length, dropped: proxies.length - lines.length, warnings: [...new Set(model.warnings.map(item => item.code))] }, null, 2));
