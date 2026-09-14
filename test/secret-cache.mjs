import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const managedPlugins = fs.readFileSync(new URL('../src/managed-plugins.js', import.meta.url), 'utf8');

assert.match(index, /const cacheVariant = `loon:\$\{powerProfile\}`;/);
assert.match(index, /const cacheVariant = `status:\$\{powerProfile\}`;/);
assert.doesNotMatch(index, /excludePinned|includePinned/);
assert.match(index, /controlPlanePolicy: env\.CONTROL_PLANE_POLICY \|\| ''/);
assert.match(index, /controlPlaneDomains: parseCsv\(env\.CONTROL_PLANE_DOMAINS\)/);
assert.match(managedPlugins, /MANAGED_PLUGINS_JSON/);

console.log(JSON.stringify({
  ok: true,
  genericCacheVariants: true,
  personalSecretLogicRemoved: true,
  controlPlanePolicyWired: true,
  controlPlaneDomainsWired: true,
  managedPluginsEnvironmentDriven: true
}, null, 2));
