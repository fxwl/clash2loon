function normalizePluginLine(value) {
  return String(value || '').trim();
}

function parseManagedPlugins(raw, warnings) {
  const source = String(raw || '').trim();
  if (!source) return [];

  try {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) throw new Error('MANAGED_PLUGINS_JSON must be a JSON array.');
    return parsed.map(normalizePluginLine).filter(Boolean);
  } catch (error) {
    warnings.push({
      code: 'MANAGED_PLUGINS_JSON_INVALID',
      detail: error?.message || String(error)
    });
    return [];
  }
}

/**
 * Public edition default: no managed plugins are bundled.
 *
 * To persist your own Loon plugins, set MANAGED_PLUGINS_JSON to a JSON array,
 * for example:
 * ["https://example.com/plugin.lpx, enabled=true"]
 *
 * Keeping the list in an environment variable prevents personal plugin choices,
 * private URLs and tokens from being committed to the repository.
 */
export function buildManagedPlugins(env = {}) {
  const warnings = [];
  const lines = parseManagedPlugins(env.MANAGED_PLUGINS_JSON, warnings);

  return {
    lines,
    warnings,
    pluginCount: lines.length,
    source: lines.length ? 'environment' : 'empty-default'
  };
}
