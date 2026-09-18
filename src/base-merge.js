function normSectionName(name) {
  return String(name || '').trim().toLowerCase();
}

export function parseLoonConfig(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const lines = src.split(/\r?\n/);
  const preamble = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (m) {
      current = { name: m[1].trim(), header: `[${m[1].trim()}]`, lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }

  return { preamble, sections };
}

function firstSection(parsed, name) {
  const key = normSectionName(name);
  return parsed.sections.find(s => normSectionName(s.name) === key) || null;
}

function allSections(parsed, name) {
  const key = normSectionName(name);
  return parsed.sections.filter(s => normSectionName(s.name) === key);
}

function nonCommentContent(lines) {
  return lines.filter(line => {
    const t = line.trim();
    return t && !t.startsWith('#') && !t.startsWith(';');
  });
}

function namedKey(line) {
  const t = line.trim();
  if (!t || t.startsWith('#') || t.startsWith(';') || !t.includes('=')) return null;
  return t.slice(0, t.indexOf('=')).trim();
}

function renderSection(name, lines) {
  return [`[${name}]`, ...lines].join('\n');
}

function getSectionLines(parsed, name) {
  const list = allSections(parsed, name);
  if (!list.length) return [];
  const out = [];
  for (const s of list) {
    if (out.length) out.push('');
    out.push(...s.lines);
  }
  return out;
}

function generatedPolicyNames(generated) {
  const policies = new Set(['DIRECT', 'REJECT', 'PROXY']);
  for (const sectionName of ['Proxy', 'Proxy Chain', 'Proxy Group']) {
    for (const line of getSectionLines(generated, sectionName)) {
      const key = namedKey(line);
      if (key) policies.add(key);
    }
  }
  return policies;
}

function generatedFinalPolicy(generated) {
  for (const line of getSectionLines(generated, 'Rule')) {
    const m = line.match(/^\s*FINAL\s*,\s*(.+?)\s*$/i);
    if (m) return m[1].trim();
  }
  return 'DIRECT';
}

function remapNativePolicyRefs(lines, validPolicies, fallbackPolicy, warnings, section) {
  return lines.map(line => line.replace(/(\bpolicy\s*=\s*)([^,\r\n]+)/ig, (full, prefix, rawPolicy) => {
    const policy = rawPolicy.trim();
    if (!policy || validPolicies.has(policy)) return full;
    warnings.push({
      code: 'LOON_NATIVE_POLICY_REMAPPED',
      section,
      from: policy,
      to: fallbackPolicy,
      detail: `Loon-native ${section} referenced policy ${policy}, which does not exist in the YAML-derived policies; remapped to ${fallbackPolicy}.`
    });
    return `${prefix}${fallbackPolicy}`;
  }));
}

const APPLE_APNS_IPV4_RANGES = [
  '17.249.0.0/16',
  '17.252.0.0/16',
  '17.57.144.0/22',
  '17.188.128.0/18',
  '17.188.20.0/23'
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mergeGeneralCsvSetting(lines, key, additions) {
  const re = new RegExp(`^\\s*${escapeRegex(key)}\\s*=\\s*(.*)$`, 'i');
  const existing = [];
  const out = [];
  let insertionIndex = -1;

  for (const line of lines) {
    const match = line.match(re);
    if (!match) {
      out.push(line);
      continue;
    }
    if (insertionIndex < 0) insertionIndex = out.length;
    existing.push(...match[1].split(',').map(v => v.trim()).filter(Boolean));
  }

  const merged = [...new Set([...existing, ...additions].filter(Boolean))];
  const rendered = `${key} = ${merged.join(',')}`;
  if (insertionIndex < 0) out.push(rendered);
  else out.splice(insertionIndex, 0, rendered);
  return out;
}

function applyRuntimeCompatibility(lines, selfHost = '') {
  const localBypass = ['localhost', '*.local'];
  const workerBypass = String(selfHost || '').trim();
  const runtimeBypass = workerBypass ? [workerBypass] : [];
  let out = [...lines];

  // Preserve the base configuration, but guarantee that local discovery and the
  // Apple APNs ranges documented for iOS/watchOS can bypass both HTTP proxying
  // and Loon's TUN. The Worker host that served this config is also bypassed so
  // Loon can refresh its own subscription while the tunnel is active instead of
  // recursively routing that request back through itself.
  out = mergeGeneralCsvSetting(out, 'skip-proxy', [...localBypass, ...APPLE_APNS_IPV4_RANGES, ...runtimeBypass]);
  out = mergeGeneralCsvSetting(out, 'bypass-tun', [...localBypass, ...APPLE_APNS_IPV4_RANGES, ...runtimeBypass]);
  out = mergeGeneralCsvSetting(out, 'real-ip', ['*.apple.com', '*.icloud.com', ...runtimeBypass]);
  return out;
}

/**
 * Merge model:
 * - YAML/Clash owns nodes, policy groups, chains and routing.
 * - The Loon base owns native runtime sections.
 * - When options.pluginLines is supplied, [Plugin] is owned by the persistent
 *   GitHub-managed plugin list instead of the mutable base configuration.
 * - Apple Watch compatibility guards and the current Worker self-bypass are
 *   always merged into [General], even when LOON_BASE_URL points to a different
 *   remote base configuration.
 * - The generated preamble owns the final file header, so runtime metadata such
 *   as generation time stays visible at the very top of the synced Loon file.
 */
export function mergeLoonConfigs(baseText, generatedText, options = {}) {
  const base = parseLoonConfig(baseText);
  const generated = parseLoonConfig(generatedText);
  const warnings = [];
  const managedPluginLines = Array.isArray(options.pluginLines) ? options.pluginLines : null;
  const selfHost = String(options.selfHost || '').trim();

  const yamlOwned = new Set([
    'proxy', 'remote proxy', 'proxy chain', 'remote filter', 'proxy group',
    'rule', 'remote rule'
  ]);
  const loonOwned = new Set([
    'general', 'host', 'rewrite', 'script', 'plugin', 'mitm'
  ]);
  const handled = new Set([...yamlOwned, ...loonOwned]);

  const validPolicies = generatedPolicyNames(generated);
  const fallbackPolicy = generatedFinalPolicy(generated);
  validPolicies.add(fallbackPolicy);

  const output = [];
  const generatedPreamble = generated.preamble.filter((line, idx, arr) => {
    if (idx === arr.length - 1 && !line.trim()) return false;
    return true;
  });
  const basePreamble = base.preamble.filter((line, idx, arr) => {
    if (idx === arr.length - 1 && !line.trim()) return false;
    return true;
  });
  const preamble = generatedPreamble.some(line => line.trim()) ? generatedPreamble : basePreamble;
  if (preamble.length) output.push(preamble.join('\n'));

  const preferredOrder = [
    'General', 'Proxy', 'Remote Proxy', 'Remote Filter', 'Proxy Group', 'Proxy Chain',
    'Rule', 'Remote Rule', 'Host', 'Rewrite', 'Script', 'Plugin', 'Mitm'
  ];

  for (const sectionName of preferredOrder) {
    const key = normSectionName(sectionName);
    const baseLines = getSectionLines(base, sectionName);
    const genLines = getSectionLines(generated, sectionName);
    let lines = [];

    if (yamlOwned.has(key)) {
      lines = genLines;
    } else if (key === 'plugin' && managedPluginLines) {
      lines = managedPluginLines;
      lines = remapNativePolicyRefs(lines, validPolicies, fallbackPolicy, warnings, sectionName);
    } else {
      lines = baseLines.length || firstSection(base, sectionName) ? baseLines : genLines;
      if (key === 'general') {
        lines = applyRuntimeCompatibility(lines, selfHost);
      } else if (key !== 'mitm') {
        lines = remapNativePolicyRefs(lines, validPolicies, fallbackPolicy, warnings, sectionName);
      }
    }

    const shouldEmitSection = yamlOwned.has(key)
      ? nonCommentContent(lines).length > 0
      : (lines.length || firstSection(base, sectionName) || firstSection(generated, sectionName) || (key === 'plugin' && managedPluginLines));

    if (shouldEmitSection) {
      output.push(renderSection(sectionName, lines));
    }
  }

  const preservedUnknownSections = [];
  for (const section of base.sections) {
    const key = normSectionName(section.name);
    if (handled.has(key)) continue;
    preservedUnknownSections.push(section.name);
    const repaired = remapNativePolicyRefs(
      section.lines,
      validPolicies,
      fallbackPolicy,
      warnings,
      section.name
    );
    output.push(renderSection(section.name, repaired));
  }

  const effectivePluginLines = managedPluginLines || getSectionLines(base, 'Plugin');

  return {
    config: output.join('\n\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n',
    warnings,
    stats: {
      baseSections: base.sections.length,
      preservedUnknownSections: preservedUnknownSections.length,
      baseHasGeneral: Boolean(firstSection(base, 'General')),
      baseHasPlugins: nonCommentContent(getSectionLines(base, 'Plugin')).length > 0,
      baseHasMitm: Boolean(firstSection(base, 'Mitm')),
      managedPluginMode: Boolean(managedPluginLines),
      managedPluginCount: nonCommentContent(effectivePluginLines).length,
      appleWatchCompat: true,
      appleApnsDirectRanges: APPLE_APNS_IPV4_RANGES.length,
      selfHostBypass: Boolean(selfHost),
      selfHost: selfHost || null,
      yamlOwnsNodes: true,
      yamlOwnsProxyGroups: true,
      yamlOwnsRouting: true,
      yamlFinalPolicy: fallbackPolicy,
      nativePolicyRemaps: warnings.filter(w => w.code === 'LOON_NATIVE_POLICY_REMAPPED').length
    },
    preservedUnknownSections,
    finalPolicySource: 'yaml'
  };
}
