import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const reality = {
  'public-key': 'TEST_PUBLIC_KEY',
  'short-id': 'abcd1234'
};

const clash = {
  proxies: [
    {
      name: 'VLESS Reality',
      type: 'vless',
      server: 'vless.example.com',
      port: 443,
      uuid: '11111111-1111-1111-1111-111111111111',
      network: 'tcp',
      tls: true,
      servername: 'www.apple.com',
      'client-fingerprint': 'chrome',
      'reality-opts': reality,
      udp: true
    },
    {
      name: 'VMess Reality',
      type: 'vmess',
      server: 'vmess.example.com',
      port: 443,
      uuid: '22222222-2222-2222-2222-222222222222',
      cipher: 'auto',
      network: 'tcp',
      tls: true,
      servername: 'www.apple.com',
      'client-fingerprint': 'chrome',
      'reality-opts': reality,
      udp: true
    },
    {
      name: 'Trojan Reality',
      type: 'trojan',
      server: 'trojan.example.com',
      port: 443,
      password: 'secret',
      network: 'tcp',
      sni: 'www.apple.com',
      'client-fingerprint': 'chrome',
      alpn: ['h2', 'http/1.1'],
      'reality-opts': reality,
      udp: true
    },
    {
      name: 'HY2 Hop',
      type: 'hysteria2',
      server: 'hy2.example.com',
      port: 443,
      password: 'hy2-secret',
      sni: 'hy2.example.com',
      ports: '20000-20100',
      'hop-interval': 30,
      down: '100 Mbps',
      alpn: ['h3'],
      udp: true
    },
    {
      name: 'AnyTLS',
      type: 'anytls',
      server: 'anytls.example.com',
      port: 443,
      password: 'any-secret',
      sni: 'anytls.example.com',
      'client-fingerprint': 'chrome',
      'reality-opts': reality,
      'idle-session-timeout': 30,
      'max-stream-count': 8,
      'idle-session-check-interval': 5,
      'min-idle-session': 2,
      udp: true
    }
  ],
  'proxy-groups': [
    {
      name: 'Fallback',
      type: 'fallback',
      proxies: ['VLESS Reality', 'VMess Reality'],
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      timeout: 2500
    },
    {
      name: 'LB',
      type: 'load-balance',
      proxies: ['Trojan Reality', 'HY2 Hop', 'AnyTLS'],
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      timeout: 2500,
      strategy: 'round-robin'
    }
  ],
  'rule-providers': {},
  rules: ['MATCH,Fallback']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'source'
});

const lines = out.nodes.split('\n');

const vless = lines.find(line => line.startsWith('VLESS Reality = VLESS,'));
assert.ok(vless?.includes('public-key="TEST_PUBLIC_KEY"'));
assert.ok(vless?.includes('short-id=abcd1234'));
assert.ok(vless?.includes('tls-profile=chrome'));

const vmess = lines.find(line => line.startsWith('VMess Reality = VMess,'));
assert.ok(vmess?.includes(',auto,"22222222-2222-2222-2222-222222222222",transport=tcp,alterId=0'));
assert.ok(vmess?.includes('public-key="TEST_PUBLIC_KEY"'));
assert.ok(vmess?.includes('tls-profile=chrome'));

const trojan = lines.find(line => line.startsWith('Trojan Reality = trojan,'));
assert.ok(trojan?.includes('public-key="TEST_PUBLIC_KEY"'));
assert.ok(trojan?.includes('short-id=abcd1234'));
assert.ok(trojan?.includes('alpn="h2,http/1.1"'));

const hy2 = lines.find(line => line.startsWith('HY2 Hop = Hysteria2,'));
assert.ok(hy2?.includes('server-ports="20000:20100"'));
assert.ok(hy2?.includes('hop-interval=30'));
assert.ok(hy2?.includes('download-bandwidth=100'));
assert.ok(!out.warnings.some(w => w.code === 'HY2_PORT_HOPPING_DROPPED'));

const anytls = lines.find(line => line.startsWith('AnyTLS = AnyTLS,'));
assert.ok(anytls?.includes('idle-session-timeout=30'));
assert.ok(anytls?.includes('max-stream-count=8'));
assert.ok(anytls?.includes('public-key="TEST_PUBLIC_KEY"'));
assert.ok(out.warnings.filter(w => w.code === 'ANYTLS_OPTION_DROPPED').length === 2);

const fallback = out.config.split('\n').find(line => line.startsWith('Fallback = fallback,'));
assert.ok(fallback);
assert.ok(fallback.includes('interval=300'));
assert.ok(fallback.includes('max-timeout=2500'));

const loadBalance = out.config.split('\n').find(line => line.startsWith('LB = load-balance,'));
assert.ok(loadBalance);
assert.ok(loadBalance.includes('algorithm=Round-Robin'));

assert.ok(!out.warnings.some(w => w.code === 'GROUP_TYPE_DOWNGRADED' && ['Fallback', 'LB'].includes(w.group)));

console.log(JSON.stringify({
  ok: true,
  nodeTypes: out.stats.nodeTypes,
  fallback,
  loadBalance,
  warningCodes: [...new Set(out.warnings.map(w => w.code))]
}, null, 2));
