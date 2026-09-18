import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const managedPlugins = fs.readFileSync(new URL('../src/managed-plugins.js', import.meta.url), 'utf8');

assert.match(index, /const cacheVariant = `loon:v1\.5\.21:\$\{powerProfile\}`;/);
assert.match(index, /const cacheVariant = `status:v1\.5\.21:\$\{powerProfile\}`;/);
assert.match(index, /const compactParam = String\(url\.searchParams\.get\('compact'\) \|\| ''\)/);
assert.match(index, /groupCompaction/);
assert.doesNotMatch(index, /locationPluginState|excludePinned|includePinned/);
assert.match(index, /controlPlanePolicy: env\.CONTROL_PLANE_POLICY \|\| ''/);
assert.match(index, /controlPlaneDomains: parseCsv\(env\.CONTROL_PLANE_DOMAINS\)/);
assert.match(managedPlugins, /MANAGED_PLUGINS_JSON/);

console.log(JSON.stringify({
  ok: true,
  cacheRevision: 'v1.5.21',
  compactFallbackWired: true,
  personalSecretLogicRemoved: true,
  controlPlanePolicyWired: true,
  controlPlaneDomainsWired: true,
  managedPluginsEnvironmentDriven: true
}, null, 2));
