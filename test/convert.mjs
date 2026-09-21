import fs from 'node:fs';
import { parse } from 'yaml';
import { convertClashToLoon } from '../src/converter.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm test -- /path/to/clash.yaml');
  process.exit(2);
}
const clash = parse(fs.readFileSync(file, 'utf8'));
const out = convertClashToLoon(clash, {
  baseUrl: 'https://example.workers.dev',
  token: 'TEST_TOKEN'
});

const mustContain = [
  '[General]', '[Proxy]', '[Remote Proxy]', '[Proxy Chain]', '[Proxy Group]', '[Rule]', '[Remote Rule]',
  'FINAL,'
];
for (const needle of mustContain) {
  if (!out.config.includes(needle)) throw new Error(`Generated config missing ${needle}`);
}
if (out.stats.convertedNodes <= 0) throw new Error('No supported nodes were converted.');
if (!out.nodes.trim()) throw new Error('Linked /nodes output is empty.');
if (out.stats.nodeDelivery !== 'remote-proxy') throw new Error('Expected remote-proxy node delivery.');

console.log(JSON.stringify({
  ok: true,
  stats: out.stats,
  finalPolicy: out.finalPolicy,
  warningCodes: [...new Set(out.warnings.map(w => w.code))]
}, null, 2));
