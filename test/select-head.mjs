import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const preferred = 'Preferred-US';
const otherA = 'JP-Test';
const otherB = 'SG-Test';

const clash = {
  proxies: [
    {
      name: preferred,
      type: 'vless',
      server: '192.0.2.10',
      port: 443,
      uuid: '11111111-2222-3333-4444-555555555555',
      encryption: 'none',
      tls: true,
      servername: 'example.com',
      network: 'tcp',
      flow: 'xtls-rprx-vision',
      udp: true,
      'reality-opts': {
        'public-key': 'TEST_PUBLIC_KEY',
        'short-id': '60',
        '_spider-x': '/test'
      }
    },
    { name: otherA, type: 'trojan', server: 'jp.example.com', port: 443, password: 'test-password-a', sni: 'jp.example.com', udp: true },
    { name: otherB, type: 'trojan', server: 'sg.example.com', port: 443, password: 'test-password-b', sni: 'sg.example.com', udp: true }
  ],
  'proxy-groups': [
    { name: 'Service Proxy', type: 'select', proxies: [preferred, 'Main Proxy', 'Auto', 'DIRECT', 'REJECT', otherA, otherB] },
    { name: 'Main Proxy', type: 'select', proxies: ['Auto', preferred, otherA, otherB] },
    { name: 'Auto', type: 'url-test', proxies: [preferred, otherA, otherB], url: 'https://www.gstatic.com/generate_204', interval: 300 }
  ],
  'rule-providers': {},
  rules: ['MATCH,Service Proxy']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery',
  controlPlanePolicy: 'Main Proxy',
  controlPlaneDomains: ['resources.example.com', '=exact.example.net']
});

const header = out.config.split('\n').slice(0, 4);
assert.equal(header[0], '# Clash2Loon v1.5.25');
assert.match(header[1], /^# Generated at: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} GMT\+8$/);
assert.equal(header[2], '# Power profile: battery');

const serviceLine = out.config.split('\n').find(line => line.startsWith('Service Proxy = '));
assert.equal(serviceLine, `Service Proxy = select,${preferred},Main Proxy,Auto,DIRECT,REJECT,${otherA},${otherB}`);

const mainLine = out.config.split('\n').find(line => line.startsWith('Main Proxy = '));
assert.equal(mainLine, `Main Proxy = select,Auto,${preferred},${otherA},${otherB}`);

const autoLine = out.config.split('\n').find(line => line.startsWith('Auto = url-test,'));
assert.ok(autoLine);
assert.ok(autoLine.startsWith(`Auto = url-test,${preferred},${otherA},${otherB},`));
assert.match(autoLine, /interval=10800/);

assert.match(out.config, /\[Rule\]\nDOMAIN-SUFFIX,resources\.example\.com,Main Proxy\nDOMAIN,exact\.example\.net,Main Proxy\nFINAL,Service Proxy/);
assert.equal(out.stats.controlPlanePolicy, 'Main Proxy');
assert.equal(out.stats.controlPlaneRules, 2);
assert.ok(out.config.includes('[Remote Proxy]'));
assert.ok(out.config.includes('C2L_Nodes = https://example.workers.dev/nodes?token=TEST_TOKEN'));
assert.ok(!out.config.includes('[Remote Filter]'));
assert.ok(!out.config.includes(`${preferred} = VLESS,`));
assert.equal(out.stats.nodeDelivery, 'remote-proxy');
assert.equal(out.stats.remoteFilters, 0);
assert.ok(out.nodes.split('\n').some(line => line.startsWith(`${preferred} = VLESS,`)));
assert.ok(out.nodes.split('\n').some(line => line.startsWith(`${otherA} = trojan,`)));
assert.ok(out.nodes.split('\n').some(line => line.startsWith(`${otherB} = trojan,`)));
assert.ok(out.warnings.some(w => w.code === 'VLESS_REALITY_SPIDER_X_DROPPED'));

console.log(JSON.stringify({
  ok: true,
  header,
  controlPlanePolicy: out.stats.controlPlanePolicy,
  controlPlaneRules: out.stats.controlPlaneRules,
  linkedNodes: true
}, null, 2));
