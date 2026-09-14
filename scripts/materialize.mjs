import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Materialize patch target missing: ${label}`);
  }
  return source.replace(from, to);
}

function patchConverterForLoon(source) {
  source = replaceRequired(
    source,
    'function fnv1a(text) {',
    "function qRegex(v) {\n  const s = str(v).replace(/[\\r\\n]+/g, ' ').split('\\\"').join(String.fromCharCode(92, 34));\n  return '\"' + s + '\"';\n}\nfunction formatGeneratedAt(date = new Date()) {\n  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);\n  const pad = n => String(n).padStart(2, '0');\n  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())} GMT+8`;\n}\nfunction stableSerialize(value) {\n  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';\n  if (value && typeof value === 'object') {\n    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableSerialize(value[key])).join(',') + '}';\n  }\n  return JSON.stringify(value);\n}\nfunction proxyFingerprint(proxy) {\n  const normalized = {};\n  for (const key of Object.keys(proxy || {}).sort()) {\n    if (key === 'name') continue;\n    normalized[key] = proxy[key];\n  }\n  return stableSerialize(normalized);\n}\nfunction deduplicateProxies(sourceProxies) {\n  const seen = new Map();\n  const aliases = new Map();\n  const duplicates = [];\n  const proxies = [];\n  for (const proxy of sourceProxies) {\n    const name = cleanName(proxy?.name);\n    if (!name) { proxies.push(proxy); continue; }\n    const fingerprint = proxyFingerprint(proxy);\n    const keep = seen.get(fingerprint);\n    if (!keep) {\n      seen.set(fingerprint, name);\n      proxies.push(proxy);\n      continue;\n    }\n    if (name !== keep) aliases.set(name, keep);\n    duplicates.push({ keep, removed: name });\n  }\n  return { proxies, aliases, duplicates };\n}\nfunction remapGroupsForDedup(groups, aliases) {\n  if (!aliases.size) return groups;\n  const groupNames = new Set(groups.map(group => cleanName(group?.name)).filter(Boolean));\n  return groups.map(group => {\n    if (!Array.isArray(group?.proxies)) return group;\n    const seen = new Set();\n    const members = [];\n    for (const raw of group.proxies) {\n      const name = cleanName(raw);\n      const mapped = !groupNames.has(name) && aliases.has(name) ? aliases.get(name) : name;\n      if (!mapped || seen.has(mapped)) continue;\n      seen.add(mapped);\n      members.push(mapped);\n    }\n    return { ...group, proxies: members };\n  });\n}\nfunction fnv1a(text) {",
    'regex, timestamp and node dedup helpers'
  );

  source = replaceRequired(
    source,
    'const filterName = `__C2L_NodeSet_${hash}_${idx + 1}`;',
    'const filterName = `C2L_NodeSet_${hash}_${idx + 1}`;',
    'filter alias prefix'
  );
  source = replaceRequired(
    source,
    'filterLines.push(`${filterName} = NameRegex,${sourceAlias}, FilterKey = ${q(regex)}`);',
    'filterLines.push(`${filterName} = NameRegex, FilterKey = ${qRegex(regex)}`);',
    'NameRegex source scoping and regex quoting'
  );
  source = replaceRequired(
    source,
    "!m.startsWith('__C2L_NodeSet_')",
    "!m.startsWith('C2L_NodeSet_')",
    'filter member recognition'
  );
  source = replaceRequired(
    source,
    "const nodeSourceAlias = '__C2L_Nodes';",
    "const nodeSourceAlias = 'C2L_Nodes';",
    'remote proxy alias'
  );

  source = replaceRequired(
    source,
    "  const target = profile === 'battery'\n    ? { primary: 1800, region: 1800, low: 3600, home: 1800, other: 1800 }",
    "  const target = profile === 'battery'\n    ? { primary: 3600, region: 7200, low: 14400, home: 7200, other: 10800 }",
    'battery url-test intervals'
  );

  source = replaceRequired(
    source,
    "    const nodeMembers = raw.filter(m => regularNodes.has(m));\n    const nodeSet = new Set(nodeMembers);\n    const filterNames = filtersFor(nodeMembers);\n    compressedNodeReferences += nodeMembers.length;\n\n    const members = [];\n    let insertedFilters = false;\n    for (const member of raw) {\n      if (nodeSet.has(member)) {\n        if (!insertedFilters) {\n          members.push(...filterNames);\n          insertedFilters = true;\n        }\n        continue;\n      }\n      members.push(member);\n    }\n    if (!insertedFilters && filterNames.length) members.push(...filterNames);",
    "    const nodeMembers = raw.filter(m => regularNodes.has(m));\n    compressedNodeReferences += nodeMembers.length;\n\n    const members = [];\n    let pendingNodes = [];\n    const flushPendingNodes = () => {\n      if (!pendingNodes.length) return;\n      members.push(...filtersFor(pendingNodes));\n      pendingNodes = [];\n    };\n    for (const member of raw) {\n      if (regularNodes.has(member)) {\n        pendingNodes.push(member);\n        continue;\n      }\n      flushPendingNodes();\n      members.push(member);\n    }\n    flushPendingNodes();",
    'compact contiguous node runs while preserving YAML order'
  );

  source = replaceRequired(
    source,
    "  const proxies = Array.isArray(clash?.proxies) ? clash.proxies : [];\n  const groups = Array.isArray(clash?.['proxy-groups']) ? clash['proxy-groups'] : [];",
    "  const sourceProxies = Array.isArray(clash?.proxies) ? clash.proxies : [];\n  const sourceGroups = Array.isArray(clash?.['proxy-groups']) ? clash['proxy-groups'] : [];\n  const dedup = deduplicateProxies(sourceProxies);\n  const duplicateAliases = dedup.aliases;\n  const proxies = dedup.proxies.map(proxy => {\n    const via = cleanName(proxy?.['dialer-proxy']);\n    return via && duplicateAliases.has(via) ? { ...proxy, 'dialer-proxy': duplicateAliases.get(via) } : proxy;\n  });\n  const groups = remapGroupsForDedup(sourceGroups, duplicateAliases);\n  if (dedup.duplicates.length) {\n    warnings.push({\n      code: 'DUPLICATE_NODES_REMOVED',\n      detail: `Removed ${dedup.duplicates.length} duplicate node definition(s); kept the first identical configuration.`,\n      examples: dedup.duplicates.slice(0, 10)\n    });\n  }",
    'deduplicate source proxies and remap group references'
  );
  source = replaceRequired(
    source,
    "      sourceNodes: proxies.length, convertedNodes, proxyChains: chainLines.length,",
    "      sourceNodes: sourceProxies.length, deduplicatedNodes: proxies.length, duplicateNodesRemoved: dedup.duplicates.length, convertedNodes, proxyChains: chainLines.length,",
    'deduplication stats'
  );

  source = replaceRequired(
    source,
    "'[Remote Proxy]', `${nodeSourceAlias} = ${nodesUrl}`, '',",
    "'[Remote Proxy]', `${nodeSourceAlias} = ${nodesUrl},udp=true,enabled=true`, '',",
    'stable remote proxy URL and enabled state'
  );

  source = replaceRequired(
    source,
    "    '# Generated dynamically by Clash2Loon Cloudflare Worker v1.5 strict-native',\n    `# Upstream nodes: ${proxies.length}; groups: ${groups.length}; providers: ${Object.keys(providers).length}; rules: ${rules.length}`,\n    `# Power profile: ${power.profile}; adjusted url-test groups: ${adjustedPowerGroups}/${compact.powerTuning.length}`,\n    '# Nodes are loaded from /nodes; large Clash node lists are represented by dynamic Loon NameRegex filters.',",
    "    '# Clash2Loon v1.5.16',\n    `# Generated at: ${formatGeneratedAt()}`,\n    `# Power profile: ${power.profile}`,",
    'concise generated config header'
  );

  source = source.replaceAll('v1.5 strict-native', 'v1.5.16 strict-native');
  source = source.replaceAll('loon-doc-strict-v1.5', 'loon-doc-strict-v1.5.16');
  return source;
}

function patchIndexVersion(source) {
  return source
    .replaceAll('Clash2Loon-Worker/1.5', 'Clash2Loon-Worker/1.5.16')
    .replaceAll('v1.5-strict-native', 'v1.5.16-strict-native')
    .replaceAll('v1.5 strict native', 'v1.5.16 strict native');
}

async function joinParts(sourceDir, outputFile, count, transform = value => value) {
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const part = `part-${String(i).padStart(2, '0')}`;
    chunks.push(await readFile(path.join(sourceDir, part), 'utf8'));
  }
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, transform(chunks.join('')), 'utf8');
}

await joinParts('source-parts/converter', 'src/converter.js', 5, patchConverterForLoon);
await joinParts('source-parts/index', 'src/index.js', 4, patchIndexVersion);

console.log('Materialized src/converter.js and src/index.js (public edition)');
