import { EMBEDDED_LOON_BASE } from '../src/base-loon.js';
import { mergeLoonConfigs } from '../src/base-merge.js';

const generated = `# generated
[General]
ip-mode = dual

[Proxy]
ExampleNode = VLESS,example.com,443,"uuid",transport=tcp,over-tls=true

[Remote Proxy]

[Proxy Chain]
ExampleChain = ExampleNode,ExampleNode,udp=true

[Remote Filter]

[Proxy Group]
Main = select,ExampleNode
Final = select,Main,DIRECT

[Rule]
FINAL,Final

[Remote Rule]
https://worker.example/rule, policy=Main, tag=dynamic, enabled=true

[Plugin]
https://example.com/generated.lpx, enabled=true

[Mitm]
hostname = generated.example
`;

const base = `${EMBEDDED_LOON_BASE}
[DNS]
custom-option = keep-me
policy=MissingPolicy
`;
const out = mergeLoonConfigs(base, generated);

if (!out.config.startsWith('# generated\n\n[General]')) {
  throw new Error('Generated preamble was not preserved at the top of the final config.');
}

const required = [
  ['base General', 'disable-stun = true'],
  ['dynamic proxy', 'ExampleNode = VLESS'],
  ['dynamic chain', 'ExampleChain = ExampleNode,ExampleNode,udp=true'],
  ['dynamic group', 'Main = select,ExampleNode'],
  ['dynamic remote rule', 'tag=dynamic'],
  ['YAML FINAL', 'FINAL,Final'],
  ['unknown Loon section', '[DNS]\ncustom-option = keep-me']
];
for (const [name, needle] of required) {
  if (!out.config.includes(needle)) throw new Error(`Missing ${name}: ${needle}`);
}

const forbidden = [
  ['generated General overriding base', 'ip-mode = dual'],
  ['generated Mitm overriding base', 'generated.example'],
  ['generated Plugin overriding base', 'generated.lpx']
];
for (const [name, needle] of forbidden) {
  if (out.config.includes(needle)) throw new Error(`Found forbidden ${name}: ${needle}`);
}

if (!out.config.includes('policy=Final')) {
  throw new Error('Stale policy reference was not remapped to YAML final policy.');
}
if (out.stats.nativePolicyRemaps < 1) throw new Error('Expected native policy remap warnings.');

console.log(JSON.stringify({
  ok: true,
  preamblePreserved: true,
  mergeStats: out.stats,
  preservedUnknownSections: out.preservedUnknownSections,
  warningCodes: [...new Set(out.warnings.map(w => w.code))]
}, null, 2));
