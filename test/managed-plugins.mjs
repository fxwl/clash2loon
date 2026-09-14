import assert from 'node:assert/strict';
import { buildManagedPlugins } from '../src/managed-plugins.js';
import { mergeLoonConfigs } from '../src/base-merge.js';

const configured = buildManagedPlugins({
  MANAGED_PLUGINS_JSON: JSON.stringify([
    'https://example.com/plugin-a.lpx, enabled=true',
    'https://example.com/plugin-b.lpx, policy=ProxyGroup, enabled=false'
  ])
});

assert.equal(configured.pluginCount, 2);
assert.equal(configured.source, 'environment');
assert.equal(configured.warnings.length, 0);
assert.ok(configured.lines.includes('https://example.com/plugin-a.lpx, enabled=true'));

const empty = buildManagedPlugins({});
assert.equal(empty.pluginCount, 0);
assert.equal(empty.source, 'empty-default');
assert.deepEqual(empty.lines, []);

const invalid = buildManagedPlugins({ MANAGED_PLUGINS_JSON: '{not-json}' });
assert.equal(invalid.pluginCount, 0);
assert.ok(invalid.warnings.some(w => w.code === 'MANAGED_PLUGINS_JSON_INVALID'));

const base = `
[General]
ip-mode = v4-only

[Plugin]
https://example.invalid/base-plugin.lpx, enabled=true

[Mitm]
hostname =
`;

const generated = `
[Proxy]

[Proxy Group]
ProxyGroup = select,DIRECT
FinalGroup = select,DIRECT

[Rule]
FINAL,FinalGroup
`;

const merged = mergeLoonConfigs(base, generated, { pluginLines: configured.lines });
assert.ok(!merged.config.includes('base-plugin.lpx'));
assert.ok(merged.config.includes('plugin-a.lpx'));
assert.ok(merged.config.includes('plugin-b.lpx'));
assert.equal(merged.stats.managedPluginMode, true);
assert.equal(merged.stats.managedPluginCount, 2);

console.log(JSON.stringify({
  ok: true,
  pluginCount: configured.pluginCount,
  emptyDefault: empty.pluginCount === 0,
  invalidJsonWarns: true,
  managedPluginMode: merged.stats.managedPluginMode
}, null, 2));
