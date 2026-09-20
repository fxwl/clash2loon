import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const transitNode = 'Transit-US';
const transitGroup = 'Transit';
const directSocks = 'SOCKS Direct';
const chainedSocks = 'SOCKS Exit';

const clash = {
  proxies: [
    {
      name: transitNode,
      type: 'trojan',
      server: 'transit.example.com',
      port: 443,
      password: 'transit-password',
      sni: 'transit.example.com',
      udp: true
    },
    {
      name: directSocks,
      type: 'socks',
      server: 'direct.example.com',
      port: 1080,
      udp: false
    },
    {
      name: chainedSocks,
      type: 'socks5',
      server: 'socks.example.com',
      port: 443,
      username: 'user,name',
      password: 'p,ass',
      tls: true,
      sni: 'socks.example.com',
      'skip-cert-verify': false,
      tfo: true,
      udp: true,
      'dialer-proxy': transitGroup
    }
  ],
  'proxy-groups': [
    {
      name: transitGroup,
      type: 'select',
      proxies: [transitNode]
    },
    {
      name: 'Main',
      type: 'select',
      proxies: [chainedSocks, directSocks, transitGroup]
    }
  ],
  'rule-providers': {},
  rules: ['MATCH,Main']
};

const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN',
  powerProfile: 'battery'
});

const directLine = out.config.split('\n').find(line => line.startsWith(`${directSocks} = socks5,`));
assert.equal(
  directLine,
  `${directSocks} = socks5,direct.example.com,1080,udp=false`,
  'Mihomo type=socks must convert to an unauthenticated Loon socks5 node'
);

const landingName = `${chainedSocks} · 落地`;
const landingLine = out.config.split('\n').find(line => line.startsWith(`${landingName} = socks5,`));
assert.equal(
  landingLine,
  `${landingName} = socks5,socks.example.com,443,"user,name","p,ass",over-tls=true,sni=socks.example.com,skip-cert-verify=false,fast-open=true,udp=true`,
  'authenticated TLS SOCKS5 landing node must preserve supported options'
);

const chainLine = out.config.split('\n').find(line => line.startsWith(`${chainedSocks} = `));
assert.equal(
  chainLine,
  `${chainedSocks} = ${transitGroup},${landingName},udp=true`,
  'dialer-proxy SOCKS5 node must become a Loon Proxy Chain'
);

const mainLine = out.config.split('\n').find(line => line.startsWith('Main = select,'));
assert.equal(mainLine, `Main = select,${chainedSocks},${directSocks},${transitGroup}`);

assert.equal(out.stats.proxyChains, 1);
assert.equal(out.stats.nodeTypes.socks5, 2);
assert.ok(!out.warnings.some(w =>
  w.code === 'PROXY_TYPE_UNSUPPORTED' &&
  [directSocks, chainedSocks, landingName].includes(w.node)
));

const landingEntry = out.nodeEntries.find(item => item.originalName === chainedSocks);
assert.ok(landingEntry);
assert.equal(landingEntry.subtype, 'socks5');
assert.equal(landingEntry.landing, true);

console.log(JSON.stringify({
  ok: true,
  directLine,
  landingLine,
  chainLine,
  proxyChains: out.stats.proxyChains,
  socks5Nodes: out.stats.nodeTypes.socks5
}, null, 2));
