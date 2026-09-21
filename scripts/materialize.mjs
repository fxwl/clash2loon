import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Materialize patch target missing: ${label}`);
  }
  return source.replace(from, to);
}

function patchConverterForLoon(source) {
  // v1.5.24 delivers converted nodes through /nodes as a Loon Remote Proxy
  // subscription. Large policy groups use source-scoped NameRegex filters so
  // removed upstream nodes disappear with the linked subscription refresh.
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
    'filterLines.push(`${filterName} = NameRegex,${sourceAlias},FilterKey=${qRegex(regex)}`);',
    'source-scoped remote NameRegex filters and regex quoting'
  );
  source = replaceRequired(
    source,
    "    const missing = members.filter(m =>\n      !BUILTIN_POLICIES.has(m) &&\n      !groupNames.has(m) &&\n      !chains.has(m) &&\n      !m.startsWith('__C2L_NodeSet_')\n    );",
    "    const missing = missingMembers;",
    'group missing-member warnings'
  );
  source = replaceRequired(
    source,
    "const nodeSourceAlias = '__C2L_Nodes';",
    "const nodeSourceAlias = 'C2L_Nodes';",
    'remote proxy alias'
  );

  // Battery-first profile: keep the primary auto group responsive enough for
  // daily use while greatly reducing background probes from region/low-rate/
  // home/other url-test groups.
  source = replaceRequired(
    source,
    "  const target = profile === 'battery'\n    ? { primary: 1800, region: 1800, low: 3600, home: 1800, other: 1800 }",
    "  const target = profile === 'battery'\n    ? { primary: 3600, region: 7200, low: 14400, home: 7200, other: 10800 }",
    'battery url-test intervals'
  );

  source = replaceRequired(
    source,
    "function createCompactGroups(groups, regularNodeNames, chainNames, sourceAlias, warnings, powerProfile = 'balanced') {",
    "function createCompactGroups(groups, regularNodeNames, chainNames, sourceAlias, warnings, powerProfile = 'balanced', enableGroupCompaction = true) {",
    'group compaction feature switch'
  );

  source = replaceRequired(
    source,
    "  const regularNodes = new Set(regularNodeNames);\n  const chains = new Set(chainNames);",
    "  const regularNodes = new Set(regularNodeNames);\n  const regularNodeOrder = new Map(regularNodeNames.map((nodeName, index) => [nodeName, index]));\n  const chains = new Set(chainNames);",
    'regular node order map'
  );

  // v1.5.24 hybrid compaction keeps small groups inline and compacts only
  // large, order-safe runs of remote nodes through exact NameRegex filters.
  // v1.5.24 inline membership semantics.
  source = replaceRequired(
    source,
    "  const dynamicGroupExpansions = [];\n  let compressedNodeReferences = 0;",
    "  const dynamicGroupExpansions = [];\n  const groupDiagnostics = [];\n  let compressedNodeReferences = 0;",
    'group diagnostics accumulator'
  );

  // Compact large, order-safe contiguous node runs through local NameRegex
  // filters. Small groups stay inline, and reversed/custom node ordering falls
  // back to inline so YAML ordering semantics are not changed.
  source = replaceRequired(
    source,
    "    const nodeMembers = raw.filter(m => regularNodes.has(m));\n    const nodeSet = new Set(nodeMembers);\n    const filterNames = filtersFor(nodeMembers);\n    compressedNodeReferences += nodeMembers.length;\n\n    const members = [];\n    let insertedFilters = false;\n    for (const member of raw) {\n      if (nodeSet.has(member)) {\n        if (!insertedFilters) {\n          members.push(...filterNames);\n          insertedFilters = true;\n        }\n        continue;\n      }\n      members.push(member);\n    }\n    if (!insertedFilters && filterNames.length) members.push(...filterNames);",
    "    const nodeMembers = raw.filter(m => regularNodes.has(m));\n    const validMembers = raw.filter(m =>\n      regularNodes.has(m) || BUILTIN_POLICIES.has(m) || groupNames.has(m) || chains.has(m)\n    );\n    const missingMembers = raw.filter(m =>\n      !regularNodes.has(m) && !BUILTIN_POLICIES.has(m) && !groupNames.has(m) && !chains.has(m)\n    );\n    const inlineMemberBytes = new TextEncoder().encode(validMembers.join(',')).length;\n    const shouldCompactGroup = enableGroupCompaction && (nodeMembers.length >= 64 || inlineMemberBytes >= 2048);\n    let compressedNodeMembers = 0;\n    let filterRefs = 0;\n    const members = [];\n    let pendingNodes = [];\n    const flushPendingNodes = () => {\n      if (!pendingNodes.length) return;\n      const runBytes = new TextEncoder().encode(pendingNodes.join(',')).length;\n      let previousIndex = -1;\n      const orderSafe = pendingNodes.every(nodeName => {\n        const index = regularNodeOrder.get(nodeName);\n        if (index == null || index <= previousIndex) return false;\n        previousIndex = index;\n        return true;\n      });\n      const shouldCompactRun = shouldCompactGroup && orderSafe && (pendingNodes.length >= 16 || runBytes >= 512);\n      if (shouldCompactRun) {\n        const refs = filtersFor(pendingNodes);\n        members.push(...refs);\n        compressedNodeMembers += pendingNodes.length;\n        filterRefs += refs.length;\n      } else {\n        members.push(...pendingNodes);\n      }\n      pendingNodes = [];\n    };\n    for (const member of validMembers) {\n      if (regularNodes.has(member)) {\n        pendingNodes.push(member);\n        continue;\n      }\n      flushPendingNodes();\n      members.push(member);\n    }\n    flushPendingNodes();\n    compressedNodeReferences += compressedNodeMembers;",
    'hybrid remote-filter compaction while preserving YAML order'
  );

  source = replaceRequired(
    source,
    "    } else {\n      warnings.push({ code: 'GROUP_TYPE_DOWNGRADED', group: name, detail: `Unsupported group type ${group.type}; emitted as select.` });\n      lines.push(`${name} = select,${members.join(',')}`);\n    }\n  }\n  return {\n    groupLines: lines,\n    filterLines,",
    "    } else {\n      warnings.push({ code: 'GROUP_TYPE_DOWNGRADED', group: name, detail: `Unsupported group type ${group.type}; emitted as select.` });\n      lines.push(`${name} = select,${members.join(',')}`);\n    }\n    const emittedLine = lines[lines.length - 1] || '';\n    groupDiagnostics.push({\n      name,\n      type: cleanName(group.type) || 'select',\n      sourceMembers: raw.length,\n      resolvedMembers: validMembers.length,\n      emittedMembers: members.length,\n      compressedNodeMembers,\n      filterRefs,\n      compactionMode: compressedNodeMembers > 0 ? 'remote-filter' : 'inline',\n      lineBytes: new TextEncoder().encode(emittedLine).length,\n      missingMembers\n    });\n  }\n  return {\n    groupLines: lines,\n    filterLines,\n    groupDiagnostics,\n    maxGroupLineBytes: Math.max(0, ...groupDiagnostics.map(item => item.lineBytes)),",
    'proxy-group diagnostics'
  );

  source = replaceRequired(
    source,
    "    warnings,\n    power.profile\n  );",
    "    warnings,\n    power.profile,\n    options.groupCompaction !== false\n  );",
    'group compaction option'
  );

  // Deduplicate exact proxy definitions before conversion. The entire proxy
  // object except `name` participates in the fingerprint, so nodes are only
  // collapsed when their effective source configuration is identical. Groups
  // and dialer-proxy references are remapped to the first retained node.
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

  // Deliver converted nodes through /nodes as a linked Loon subscription.
  // [Proxy] stays empty so the main configuration no longer accumulates local nodes.
  source = replaceRequired(
    source,
    "    '[Proxy]', '',\n    '[Remote Proxy]', `${nodeSourceAlias} = ${nodesUrl}`, '',\n    '[Remote Filter]', ...compact.filterLines, '',\n    '[Proxy Group]', ...compact.groupLines, '',",
    "    '[Proxy]', '',\n    '[Remote Proxy]', `${nodeSourceAlias} = ${nodesUrl}`, '',\n    ...(compact.filterLines.length ? ['[Remote Filter]', ...compact.filterLines, ''] : []),\n    '[Proxy Group]', ...compact.groupLines, '',",
    'remote node delivery with optional source-scoped filters'
  );
  source = replaceRequired(
    source,
    "      proxyGroups: groups.length, remoteFilters: compact.filterLines.length,",
    "      proxyGroups: groups.length, remoteFilters: compact.filterLines.length, nodeDelivery: 'remote-proxy',\n      groupCompactionMode: options.groupCompaction === false ? 'inline-fallback' : 'hybrid-remote-filter',\n      groupCompactionThresholds: { members: 64, lineBytes: 2048 },\n      compressedGroups: compact.groupDiagnostics.filter(item => item.compactionMode === 'remote-filter').length,\n      maxProxyGroupLineBytes: compact.maxGroupLineBytes,\n      groupDiagnostics: compact.groupDiagnostics,",
    'hybrid group compaction stats'
  );

  // Replace the verbose legacy banner with a concise runtime header.
  source = replaceRequired(
    source,
    "    '# Generated dynamically by Clash2Loon Cloudflare Worker v1.5 strict-native',\n    `# Upstream nodes: ${proxies.length}; groups: ${groups.length}; providers: ${Object.keys(providers).length}; rules: ${rules.length}`,\n    `# Power profile: ${power.profile}; adjusted url-test groups: ${adjustedPowerGroups}/${compact.powerTuning.length}`,\n    '# Nodes are loaded from /nodes; large Clash node lists are represented by dynamic Loon NameRegex filters.',",
    "    '# Clash2Loon v1.5.24',\n    `# Generated at: ${formatGeneratedAt()}`,\n    `# Power profile: ${power.profile}`,",
    'concise generated config header'
  );

  source = source.replaceAll('v1.5 strict-native', 'v1.5.24 strict-native');
  source = source.replaceAll('loon-doc-strict-v1.5', 'loon-doc-strict-v1.5.24');
  return source;
}

function patchIndexVersion(source) {
  source = source
    .replaceAll('Clash2Loon-Worker/1.5', 'Clash2Loon-Worker/1.5.23')
    .replaceAll('v1.5-strict-native', 'v1.5.24-strict-native')
    .replaceAll('v1.5 strict native', 'v1.5.24 strict native');

  source = replaceRequired(
    source,
    "  const url = new URL(request.url);\n  const baseUrl = `${url.protocol}//${url.host}`;\n  const rawConverted = convertClashToLoon(clash, {",
    "  const url = new URL(request.url);\n  const baseUrl = `${url.protocol}//${url.host}`;\n  const compactParam = String(url.searchParams.get('compact') || '').trim().toLowerCase();\n  const groupCompaction = !['0', 'false', 'off', 'no'].includes(compactParam);\n  const rawConverted = convertClashToLoon(clash, {",
    'compact query parsing'
  );
  source = replaceRequired(
    source,
    "    controlPlanePolicy: env.CONTROL_PLANE_POLICY || '',\n    controlPlaneDomains: parseCsv(env.CONTROL_PLANE_DOMAINS)\n  });",
    "    controlPlanePolicy: env.CONTROL_PLANE_POLICY || '',\n    controlPlaneDomains: parseCsv(env.CONTROL_PLANE_DOMAINS),\n    groupCompaction\n  });",
    'compact query wiring'
  );

  source = replaceRequired(
    source,
    "  const cacheVariant = `loon:${powerProfile}`;",
    "  const cacheVariant = `loon:v1.5.24:${powerProfile}`;",
    'Loon cache revision'
  );
  source = replaceRequired(
    source,
    "  const cacheVariant = `status:${powerProfile}`;",
    "  const cacheVariant = `status:v1.5.24:${powerProfile}`;",
    'status cache revision'
  );
  return source;
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

console.log('Materialized src/converter.js and src/index.js (public v1.5.24: dynamic groups + inline nodes + hybrid local-filter compaction)');
