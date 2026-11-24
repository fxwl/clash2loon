import { readFile, writeFile } from 'node:fs/promises';

// Applied AFTER materialize, upgrade-private and upgrade-network.
// Keep the private patch explicit and fail the build if its source anchors drift.
function replaceExactlyOne(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error('CPU patch anchor [' + label + '] expected once, got ' + count);
  return text.replace(from, to);
}

let converter = await readFile('src/converter.js', 'utf8');
converter = replaceExactlyOne(converter,
  "  const { ordinaryGroups, syntheticDialerGroups } = buildChains();\n\n  const nodeSourceAlias = 'C2L_Nodes';",
  [
    '  const { ordinaryGroups, syntheticDialerGroups } = buildChains();',
    '',
    '  // Keep the lightweight /nodes path, but first validate relay chains and',
    '  // remove orphaned landing nodes. Otherwise a broken intermediate hop',
    '  // would expose the landing as a direct subscription node.',
    '  if (options.nodesOnly === true) {',
    '    return {',
    "      config: '', nodes: nodeOnlyLines.join('\\n') + (nodeOnlyLines.length ? '\\n' : ''),",
    '      nodeEntries, warnings,',
    '      stats: { sourceNodes: proxies.length, convertedNodes, warnings: warnings.length }',
    '    };',
    '  }',
    '',
    "  const nodeSourceAlias = 'C2L_Nodes';"
  ].join('\n'),
  'validated nodes-only short circuit'
);
await writeFile('src/converter.js', converter, 'utf8');

let index = await readFile('src/index.js', 'utf8');
const helpers = [
  '// The Loon client can fetch hundreds of /rule subscriptions at once.',
  '// Re-parsing the entire upstream YAML for EACH rule exhausts the Worker',
  '// CPU budget, especially on the Free plan. /loon caches the trusted',
  '// provider metadata once, before returning its remote rule URLs.',
  'function providerManifestKey(request) {',
  '  const url = new URL(request.url);',
  "  url.pathname = '/__c2l_internal_provider_manifest_v162';",
  "  url.search = '';",
  "  url.hash = '';",
  "  return new Request(url.toString(), { method: 'GET' });",
  '}',
  'function minimalProviderManifest(providers) {',
  '  const result = {};',
  '  for (const [name, def] of Object.entries(providers || {})) {',
  "    if (!def || typeof def !== 'object') continue;",
  "    if (def.type === 'inline') result[name] = { type: 'inline', behavior: def.behavior || 'classical', payload: def.payload };",
  "    else result[name] = { type: def.type, url: def.url, behavior: def.behavior, format: def.format };",
  '  }',
  '  return result;',
  '}',
  'async function cacheProviderManifest(request, rawProviders) {',
  '  try {',
  '    const data = JSON.stringify(minimalProviderManifest(rawProviders));',
  "    if (data.length > 2 * 1024 * 1024) return;",
  '    await caches.default.put(providerManifestKey(request), new Response(data, {',
  "      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' }",
  '    }));',
  '  } catch (error) {',
  "    console.warn(JSON.stringify({ event: 'provider_manifest_cache_failed', error: String(error?.message || error).slice(0, 80) }));",
  '  }',
  '}',
  'async function providerDefinition(request, env, providerName) {',
  '  try {',
  '    const cached = await caches.default.match(providerManifestKey(request));',
  '    if (cached) {',
  '      const providers = await cached.json();',
  '      if (Object.prototype.hasOwnProperty.call(providers, providerName)) return providers[providerName];',
  '    }',
  '  } catch (error) {',
  "    console.warn(JSON.stringify({ event: 'provider_manifest_read_failed', error: String(error?.message || error).slice(0, 80) }));",
  '  }',
  '  // Fallback supports direct /rule updates, edge cache misses and legacy',
  '  // subscriptions; the first miss populates metadata for the next request.',
  '  const upstream = await fetchUpstreamClash(env);',
  '  const config = parse(upstream.body);',
  "  const providers = config?.['rule-providers'] || {};",
  '  await cacheProviderManifest(request, providers);',
  '  return providers[providerName];',
  '}',
  ''
].join('\n');
index = replaceExactlyOne(index,
  'async function handleLoon(request, env, ctx) {',
  helpers + '\nasync function handleLoon(request, env, ctx) {',
  'manifest helpers'
);
index = replaceExactlyOne(index,
  '  const { upstream, converted } = await loadModel(request, env);\n  const response = new Response(converted.config, {',
  [
    '  const { upstream, converted, clash } = await loadModel(request, env);',
    "  // Await storage so Loon's immediate parallel rule refreshes see it.",
    "  await cacheProviderManifest(request, clash['rule-providers']);",
    '  const response = new Response(converted.config, {'
  ].join('\n'),
  'persist manifest on /loon'
);
index = replaceExactlyOne(index,
  '  const { upstream, converted } = await loadModel(request, env);\n\n  const supported = new Set([',
  [
    '  const upstream = await fetchUpstreamClash(env);',
    '  const clashSource = parse(upstream.body);',
    "  if (!clashSource || typeof clashSource !== 'object') throw new Error('Upstream content is not a Clash YAML object.');",
    '  const clash = await resolveProxyProviders(clashSource, []);',
    '  const converted = convertClashToLoon(clash, { nodesOnly: true });',
    '',
    '  const supported = new Set(['
  ].join('\n'),
  'fast /nodes'
);
index = replaceExactlyOne(index,
  "  const upstream=await fetchUpstreamClash(env);\n  const config=parse(upstream.body);\n  const provider=config?.['rule-providers']?.[providerName];",
  '  const provider = await providerDefinition(request, env, providerName);',
  'trusted provider lookup cache'
);
await writeFile('src/index.js', index, 'utf8');
console.log('CPU optimization: nodes-only conversion + trusted provider manifest cache applied.');
