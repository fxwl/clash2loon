import assert from 'node:assert/strict';
import { convertClashToLoon } from '../src/converter.js';

const proxies = [
  { name: 'Transit', type: 'trojan', server: 'transit.example.com', port: 443, password: 'transit-pass', udp: true },
  { name: 'Transit-TCP', type: 'trojan', server: 'tcp.example.com', port: 443, password: 'tcp-pass', udp: false },
  { name: 'Plain Exit', type: 'trojan', server: 'exit.example.com', port: 443, password: 'exit-pass' },
  { name: 'Via Direct Node', type: 'trojan', server: 'via-direct.example.com', port: 443, password: 'pass', 'dialer-proxy': 'Transit' },
  { name: 'Via Existing Group', type: 'trojan', server: 'via-group.example.com', port: 443, password: 'pass', 'dialer-proxy': 'TransitGroup' },
  { name: 'Via Missing Target', type: 'trojan', server: 'via-missing.example.com', port: 443, password: 'pass', 'dialer-proxy': 'Unknown' },
  { name: 'Via Self', type: 'trojan', server: 'via-self.example.com', port: 443, password: 'pass', 'dialer-proxy': 'Via Self' },
  { name: 'Via Cycling Group', type: 'trojan', server: 'via-cycle.example.com', port: 443, password: 'pass', 'dialer-proxy': 'CyclingGroup' },
  { name: 'HY2 Via TCP Only', type: 'hy2', server: 'hy2-no-udp.example.com', port: 443, password: 'pass', 'dialer-proxy': 'Transit-TCP' },
  { name: 'HY2 Via UDP Transit', type: 'hy2', server: 'hy2-udp.example.com', port: 443, password: 'pass', 'dialer-proxy': 'Transit', udp: true }
];

const proxyGroups = [
  { name: 'TransitGroup', type: 'select', proxies: ['Transit'] },
  { name: 'CyclingGroup', type: 'select', proxies: ['Via Cycling Group'] },
  { name: 'Legacy Two Hops', type: 'relay', proxies: ['Transit', 'Plain Exit'] },
  { name: 'Legacy Three Hops', type: 'relay', proxies: ['Transit', 'Plain Exit', 'Transit-TCP'] },
  { name: 'Legacy Duplicate Hops', type: 'relay', proxies: ['Transit', 'Transit'] },
  { name: 'Main', type: 'select', proxies: [
    'Via Direct Node', 'Via Existing Group', 'Via Missing Target', 'Via Self',
    'Via Cycling Group', 'HY2 Via TCP Only', 'HY2 Via UDP Transit', 'Legacy Two Hops'
  ] }
];

const model = { proxies, 'proxy-groups': proxyGroups, 'rule-providers': {}, rules: ['MATCH,Main'] };
const opts = { baseUrl: 'https://test.workers.dev', token: 'TEST', powerProfile: 'source' };
const output = convertClashToLoon(model, opts);
const config = output.config;
const nodes = output.nodes;
const chain = name => config.split('\n').find(line => line.startsWith(name + ' = '));
const warnings = output.warnings;
const warn = code => warnings.some(item => item.code === code);

const direct = chain('Via Direct Node');
const directGroup = direct?.split(' = ')[1]?.split(',')[0];
assert.ok(directGroup?.startsWith('C2L_Dialer_'), 'direct transit must be wrapped as a Loon selector');
assert.ok(direct.includes(',Via Direct Node · 落地,udp=true'));
assert.ok(config.includes(directGroup + ' = select,'), 'transit wrapper must be defined');
assert.ok(config.includes('FilterKey='), 'wrapper must resolve its remote node by filter');

assert.equal(chain('Via Existing Group'), 'Via Existing Group = TransitGroup,Via Existing Group · 落地,udp=true');
assert.equal(chain('Via Missing Target'), undefined, 'missing transit chain must not be emitted');
assert.equal(chain('Via Self'), undefined, 'self transit must be rejected');
assert.equal(chain('Via Cycling Group'), undefined, 'self-referencing transit group must be rejected');
assert.equal(chain('HY2 Via TCP Only'), undefined, 'HY2 cannot use transit explicitly disabled for UDP');
assert.ok(chain('HY2 Via UDP Transit')?.includes(',HY2 Via UDP Transit · 落地,udp=true'));

assert.ok(!nodes.includes('Via Missing Target · 落地 ='), 'never export orphan landing node');
assert.ok(!nodes.includes('Via Self · 落地 ='), 'never export cyclic direct landing');
assert.ok(!nodes.includes('Via Cycling Group · 落地 ='), 'never export cyclic group landing');
assert.ok(!nodes.includes('HY2 Via TCP Only · 落地 ='), 'never export invalid UDP landing');
assert.ok(nodes.includes('Via Direct Node · 落地 ='), 'valid landing must be available');

const legacy = chain('Legacy Two Hops');
assert.ok(legacy?.startsWith('Legacy Two Hops = C2L_Dialer_'));
assert.ok(legacy.endsWith(',udp=true'));
assert.ok(config.includes('Legacy Two Hops = '), 'legacy 2-hop group must not disappear');
assert.ok(!config.includes('Legacy Two Hops = select,'), 'legacy relay must not be downgraded to select');
assert.ok(!config.includes('Legacy Three Hops = select,'), 'unsupported relay must never become direct select');
assert.ok(!config.includes('Legacy Duplicate Hops = '), 'adjacent identical hops must be refused');
assert.ok(warn('RELAY_GROUP_TARGET_INVALID'), 'duplicate hops must be diagnosed');

for (const code of ['DIALER_POLICY_NOT_FOUND', 'DIALER_CHAIN_CYCLE', 'DIALER_UDP_HOP_UNSUPPORTED', 'RELAY_GROUP_UNSUPPORTED']) {
  assert.ok(warn(code), 'missing diagnostic: ' + code);
}
assert.equal(output.stats.proxyChains, 4);
assert.equal(output.nodeEntries.filter(item => item.landing).length, 3);

const only = convertClashToLoon(model, { nodesOnly: true });
assert.ok(!only.nodes.includes('Via Missing Target · 落地 ='), 'fast node subscription must filter orphan landings');
assert.ok(!only.nodes.includes('Via Self · 落地 ='), 'fast node subscription must filter cyclic landings');
assert.ok(!only.nodes.includes('HY2 Via TCP Only · 落地 ='), 'fast node subscription must filter invalid HY2 landings');
assert.ok(only.nodes.includes('Via Direct Node · 落地 ='), 'fast node subscription must preserve valid landing');
assert.equal(only.stats.convertedNodes, output.stats.convertedNodes);
const invalidFinal = convertClashToLoon({ ...model, rules: ['MATCH,Legacy Three Hops'] }, opts);
assert.ok(invalidFinal.config.includes('FINAL,REJECT'), 'unsupported relay as FINAL must fail closed');
assert.ok(invalidFinal.warnings.some(item => item.code === 'FINAL_RELAY_UNAVAILABLE'));

console.log(JSON.stringify({ ok: true, chains: output.stats.proxyChains, nodes: output.stats.convertedNodes, warningCodes: [...new Set(warnings.map(w => w.code))] }, null, 2));
