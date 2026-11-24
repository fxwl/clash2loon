import { parse } from 'yaml';

// Private compatibility layer. Unsupported Mihomo-only features fail closed:
// never emit a node or a rule with silently broadened matching semantics.
const s = (v) => v == null ? '' : String(v);
const name = (v) => s(v).replace(/[\r\n]+/g, ' ').trim();
const quote = (v) => '"' + s(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"';
const atom = (v) => /[,"\s]/.test(name(v)) ? quote(name(v)) : name(v);
const boolean = (v, fallback = false) => v == null ? fallback : v === true || v === 1 || s(v).toLowerCase() === 'true';
const warn = (warnings, code, node, detail) => warnings.push({ code, node, detail });
const positive = (v) => Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;

const SS_CIPHERS = new Set(('2022-blake3-aes-128-gcm 2022-blake3-aes-256-gcm aes-128-gcm aes-192-gcm aes-256-gcm chacha20-ietf-poly1305 xchacha20-ietf-poly1305 rc4 rc4-md5 aes-128-cfb aes-192-cfb aes-256-cfb aes-128-ctr aes-192-ctr aes-256-ctr bf-cfb camellia-128-cfb camellia-192-cfb camellia-256-cfb cast5-cfb des-cfb idea-cfb rc2-cfb seed-cfb salsa20 chacha20 chacha20-ietf').split(' '));
const SSR_CIPHERS = new Set(('none rc4 rc4-md5-6 rc4-md5 aes-128-cfb aes-192-cfb aes-256-cfb aes-128-ctr aes-192-ctr aes-256-ctr bf-cfb camellia-128-cfb camellia-192-cfb camellia-256-cfb salsa20 chacha20 chacha20-ietf').split(' '));
const SSR_PROTOCOLS = new Set(('origin auth_chain_a auth_chain_b auth_aes128_md5 auth_aes128_sha1 auth_sha1_v4 auth_sha1_v2 auth_sha1').split(' '));
const SSR_OBFS = new Set(('plain tls1.2_ticket_auth http_simple http_post').split(' '));

function common(proxy, params) {
  if (proxy.tfo != null || proxy['fast-open'] != null) params.push('fast-open=' + boolean(proxy.tfo ?? proxy['fast-open']));
  if (proxy['block-quic'] != null) params.push('block-quic=' + boolean(proxy['block-quic']));
  const ips = { dual: 'dual', ipv4: 'v4-only', ipv6: 'v6-only', 'ipv4-prefer': 'prefer-v4', 'ipv6-prefer': 'prefer-v6' };
  if (ips[proxy['ip-version']]) params.push('ip-mode=' + ips[proxy['ip-version']]);
  if (proxy['server-dns']) {
    const dns = Array.isArray(proxy['server-dns']) ? proxy['server-dns'].map(name).join(',') : name(proxy['server-dns']);
    params.push('server-dns=' + quote(dns));
  }
}
function shadowTls(proxy, params, warnings) {
  const plugin = name(proxy.plugin).toLowerCase();
  const opts = plugin === 'shadow-tls' ? (proxy['plugin-opts'] || {}) : (proxy['shadow-tls-opts'] || {});
  if (!plugin && !proxy['shadow-tls-opts']) return true;
  if (plugin && plugin !== 'shadow-tls') return false;
  const version = s(opts.version ?? '').replace(/^v/, '');
  if (!['2', '3'].includes(version) || !opts.password) {
    warn(warnings, 'SHADOWTLS_OPTIONS_UNSUPPORTED', name(proxy.name), 'ShadowTLS requires a password and a documented version (2 or 3).');
    return false;
  }
  params.push('shadow-tls-password=' + quote(opts.password));
  params.push('shadow-tls-sni=' + atom(opts.host || proxy.sni || proxy.servername || proxy.server));
  params.push('shadow-tls-version=' + version);
  if (positive(opts['udp-port'])) params.push('udp-port=' + Number(opts['udp-port']));
  return true;
}
function ss(proxy, warnings, ssr = false) {
  const cipher = name(proxy.cipher).toLowerCase();
  if (!(ssr ? SSR_CIPHERS : SS_CIPHERS).has(cipher) || proxy.password == null) {
    warn(warnings, ssr ? 'SSR_CIPHER_UNSUPPORTED' : 'SS_CIPHER_UNSUPPORTED', name(proxy.name), 'Unsupported cipher or missing password; node omitted.');
    return null;
  }
  const params = [];
  if (ssr) {
    const protocol = name(proxy.protocol || 'origin');
    const obfs = name(proxy.obfs || 'plain');
    if (!SSR_PROTOCOLS.has(protocol) || !SSR_OBFS.has(obfs)) {
      warn(warnings, 'SSR_PLUGIN_UNSUPPORTED', name(proxy.name), 'Unsupported SSR protocol/obfs; node omitted.');
      return null;
    }
    params.push('protocol=' + protocol, 'protocol-param=' + atom(proxy['protocol-param'] || ''));
    params.push('obfs=' + obfs, 'obfs-param=' + atom(proxy['obfs-param'] || ''));
  } else if (proxy.plugin && name(proxy.plugin).toLowerCase() !== 'shadow-tls') {
    const plugin = name(proxy.plugin).toLowerCase();
    if (!['obfs', 'obfs-local'].includes(plugin) || !['http', 'tls'].includes(name(proxy['plugin-opts']?.mode).toLowerCase())) {
      warn(warnings, 'SS_PLUGIN_UNSUPPORTED', name(proxy.name), 'Unsupported Shadowsocks plugin; node omitted rather than dropping its transport.');
      return null;
    }
    const opts = proxy['plugin-opts'] || {};
    params.push('obfs-name=' + name(opts.mode).toLowerCase());
    if (opts.host) params.push('obfs-host=' + atom(opts.host));
    if (opts.path) params.push('obfs-uri=' + atom(opts.path));
  }
  if (proxy.plugin === 'shadow-tls' || proxy['shadow-tls-opts']) {
    if (!shadowTls(proxy, params, warnings)) return null;
  }
  if (proxy['udp-over-tcp'] != null && !ssr) params.push('udp-over-tcp=' + boolean(proxy['udp-over-tcp']));
  common(proxy, params);
  params.push('udp=' + boolean(proxy.udp, true));
  return name(proxy.name) + ' = ' + (ssr ? 'ShadowsocksR' : 'Shadowsocks') + ',' + atom(proxy.server) + ',' + proxy.port + ',' + cipher + ',' + quote(proxy.password) + ',' + params.join(',');
}
function http(proxy, warnings) {
  const https = boolean(proxy.tls);
  const params = [];
  if (https) {
    if (proxy.sni || proxy.servername) params.push('sni=' + atom(proxy.sni || proxy.servername));
    if (proxy['skip-cert-verify'] != null) params.push('skip-cert-verify=' + boolean(proxy['skip-cert-verify']));
  }
  if (proxy['always-use-connect'] != null) params.push('always-use-connect=' + boolean(proxy['always-use-connect']));
  if (proxy.headers && Object.keys(proxy.headers).length) {
    warn(warnings, 'HTTP_HEADERS_UNSUPPORTED', name(proxy.name), 'Custom HTTP proxy headers do not have an equivalent in Loon and were omitted.');
  }
  if (!shadowTls(proxy, params, warnings)) {
    warn(warnings, 'HTTP_PLUGIN_UNSUPPORTED', name(proxy.name), 'Unsupported transport plugin; node omitted.');
    return null;
  }
  common(proxy, params);
  const credentials = proxy.username != null || proxy.password != null ? ',' + quote(proxy.username || '') + ',' + quote(proxy.password || '') : '';
  return name(proxy.name) + ' = ' + (https ? 'https' : 'http') + ',' + atom(proxy.server) + ',' + proxy.port + credentials + (params.length ? ',' + params.join(',') : '');
}
function wireguard(proxy, warnings) {
  if (!proxy['private-key'] || !proxy.ip) {
    warn(warnings, 'WG_REQUIRED_FIELDS_MISSING', name(proxy.name), 'WireGuard requires ip and private-key; node omitted.');
    return null;
  }
  const peerSource = Array.isArray(proxy.peers) && proxy.peers.length ? proxy.peers :
    [{ server: proxy.server, port: proxy.port, 'public-key': proxy['public-key'],
      'pre-shared-key': proxy['pre-shared-key'], reserved: proxy.reserved, 'allowed-ips': proxy['allowed-ips'] }];
  const peers = [];
  for (const p of peerSource) {
    if (!p['public-key'] || !p.server || !positive(p.port)) {
      warn(warnings, 'WG_PEER_INVALID', name(proxy.name), 'WireGuard peer requires a public key and server:port; node omitted.');
      return null;
    }
    const fields = ['public-key=' + quote(p['public-key'])];
    if (p['pre-shared-key']) fields.push('preshared-key=' + quote(p['pre-shared-key']));
    if (p.reserved != null) {
      if (Array.isArray(p.reserved) && p.reserved.length === 3 && p.reserved.every(x => Number.isInteger(Number(x)) && Number(x) >= 0 && Number(x) <= 255)) {
        fields.push('reserved=[' + p.reserved.map(Number).join(',') + ']');
      } else {
        warn(warnings, 'WG_RESERVED_UNSUPPORTED', name(proxy.name), 'Non-array or invalid WireGuard reserved value; node omitted.');
        return null;
      }
    }
    const allowed = Array.isArray(p['allowed-ips']) ? p['allowed-ips'].join(',') : s(p['allowed-ips'] || '0.0.0.0/0,::/0');
    fields.push('allowed-ips=' + quote(allowed));
    const host = s(p.server).includes(':') && !s(p.server).startsWith('[') ? '[' + p.server + ']' : p.server;
    fields.push('endpoint=' + host + ':' + p.port);
    peers.push('{' + fields.join(',') + '}');
  }
  const params = ['interface-ip=' + atom(proxy.ip)];
  if (proxy.ipv6) params.push('interface-ipV6=' + atom(proxy.ipv6));
  params.push('private-key=' + quote(proxy['private-key']));
  if (positive(proxy.mtu)) params.push('mtu=' + Number(proxy.mtu));
  const dns = Array.isArray(proxy.dns) ? proxy.dns : (proxy.dns ? [proxy.dns] : []);
  for (const value of dns) {
    if (s(value).includes(':')) params.push('dnsV6=' + atom(value));
    else params.push('dns=' + atom(value));
  }
  if (proxy['persistent-keepalive'] != null) {
    const keep = Number(proxy['persistent-keepalive']);
    if (Number.isFinite(keep) && keep >= 0) params.push('keepalive=' + Math.trunc(keep));
  }
  params.push('peers=[' + peers.join(',') + ']');
  common(proxy, params);
  params.push('udp=' + boolean(proxy.udp, true));
  return name(proxy.name) + ' = WireGuard,' + params.join(',');
}

export function convertExtendedProxyLine(proxy, warnings) {
  const kind = name(proxy?.type).toLowerCase();
  if (!['ss', 'shadowsocks', 'ssr', 'http', 'https', 'wireguard', 'wg'].includes(kind)) return undefined;
  if (kind !== 'wireguard' && kind !== 'wg' && (!proxy.server || !positive(proxy.port))) {
    warn(warnings, 'PROXY_ADDRESS_INVALID', name(proxy.name), 'Missing server or valid port; node omitted.');
    return null;
  }
  switch (kind) {
    case 'ss': case 'shadowsocks': return ss(proxy, warnings);
    case 'ssr': return ss(proxy, warnings, true);
    case 'http': case 'https': return http(kind === 'https' ? { ...proxy, tls: true } : proxy, warnings);
    default: return wireguard(proxy, warnings);
  }
}

const LoonRuleTypes = new Set(('DOMAIN DOMAIN-SUFFIX DOMAIN-KEYWORD IP-CIDR IP-CIDR6 GEOIP IP-ASN URL-REGEX USER-AGENT DEST-PORT SRC-PORT PROTOCOL').split(' '));
const noResolveTypes = new Set(['IP-CIDR', 'IP-CIDR6', 'GEOIP', 'IP-ASN']);
export function parseInlineRule(raw) {
  const parts = s(raw).trim().split(',').map(p => p.trim());
  const incomingType = parts[0]?.toUpperCase();
  const type = incomingType === 'DST-PORT' ? 'DEST-PORT' : incomingType === 'NETWORK' ? 'PROTOCOL' : incomingType;
  if (type !== incomingType) parts[0] = type;
  if (!LoonRuleTypes.has(type) || parts.length < 3) return null;
  const noResolve = parts.at(-1).toLowerCase() === 'no-resolve';
  const policyIndex = parts.length - (noResolve ? 2 : 1);
  const policy = parts[policyIndex];
  if (!policy || policyIndex < 2) return null;
  const rule = parts.slice(0, policyIndex).join(',') + (noResolve && noResolveTypes.has(type) ? ',no-resolve' : '');
  return { policy, rule, type };
}
function domainRule(line, warnings) {
  const raw = s(line).trim();
  const m = raw.match(/^([a-z]+):(.*)$/i);
  if (m) {
    const tag = m[1].toLowerCase(), value = m[2].trim();
    if (tag === 'full' && value) return 'DOMAIN,' + value;
    if (tag === 'domain' && value) return 'DOMAIN-SUFFIX,' + value;
    if (tag === 'keyword' && value) return 'DOMAIN-KEYWORD,' + value;
    warnings.push({ code: 'DOMAIN_PATTERN_UNSUPPORTED', patternType: tag, detail: 'No equivalent Loon domain rule; pattern omitted.' });
    return null;
  }
  if (raw.startsWith('+.')) return raw.length > 2 ? 'DOMAIN-SUFFIX,' + raw.slice(2) : null;
  if (raw.startsWith('.')) return raw.length > 1 ? 'DOMAIN-SUFFIX,' + raw.slice(1) : null;
  if (raw.includes('*') || raw.includes('?') || raw.includes('^')) {
    warnings.push({ code: 'DOMAIN_PATTERN_UNSUPPORTED', detail: 'Wildcard / regexp cannot be represented as the same domain set; pattern omitted.' });
    return null;
  }
  return raw ? 'DOMAIN-SUFFIX,' + raw : null;
}
export function normalizeProviderText(text, behavior = 'classical', addNoResolve = true, warnings = []) {
  const output = [];
  for (let item of s(text).split(/\r?\n/)) {
    item = item.trim().replace(/^\uFEFF/, '');
    if (!item || item.startsWith('#') || item.startsWith(';')) continue;
    if (behavior === 'domain') {
      const rule = domainRule(item, warnings);
      if (rule) output.push(rule);
    } else if (behavior === 'ipcidr') {
      if (!/^[0-9a-f:.]+\/\d+$/i.test(item)) {
        warnings.push({ code: 'IPCIDR_PATTERN_INVALID', detail: 'Invalid CIDR entry omitted.' });
        continue;
      }
      output.push((item.includes(':') ? 'IP-CIDR6,' : 'IP-CIDR,') + item + (addNoResolve ? ',no-resolve' : ''));
    } else {
      const incomingType = item.split(',')[0].toUpperCase();
      const type = incomingType === 'DST-PORT' ? 'DEST-PORT' : incomingType === 'NETWORK' ? 'PROTOCOL' : incomingType;
      if (type !== incomingType) item = type + item.slice(incomingType.length);
      if (!LoonRuleTypes.has(type)) {
        warnings.push({ code: 'CLASSICAL_RULE_UNSUPPORTED', ruleType: type, detail: 'Unsupported classical rule type omitted.' });
        continue;
      }
      if (type.startsWith('IP-') && addNoResolve && !item.endsWith(',no-resolve')) item += ',no-resolve';
      output.push(item);
    }
  }
  return output.join('\n') + (output.length ? '\n' : '');
}
export function inlineProviderRules(provider, warnings = []) {
  if (!Array.isArray(provider?.payload)) throw new Error('Inline provider must have a payload array.');
  const behavior = name(provider.behavior || 'classical').toLowerCase();
  return normalizeProviderText(provider.payload.map(s).join('\n'), behavior, true, warnings);
}
export async function fetchBounded(url, opts = {}) {
  const value = new URL(s(url));
  if (!['http:', 'https:'].includes(value.protocol) || value.username || value.password) throw new Error('Source URL must use HTTP(S) without embedded credentials.');
  const response = await fetch(value.toString(), {
    headers: opts.headers || { 'accept': 'text/yaml,text/plain,*/*' },
    signal: AbortSignal.timeout(opts.timeout ?? 12000), redirect: 'follow'
  });
  if (!response.ok) throw new Error('Upstream returned HTTP ' + response.status);
  const limit = opts.maxBytes ?? 5 * 1024 * 1024;
  const reported = Number(response.headers.get('content-length') || 0);
  if (reported > limit) throw new Error('Upstream response exceeds size limit.');
  if (!response.body) return { body: '', response };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      total += chunk.byteLength;
      if (total > limit) throw new Error('Upstream response exceeds size limit.');
      chunks.push(chunk);
    }
  } catch (e) { await reader.cancel().catch(() => {}); throw e; }
  const all = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) { all.set(chunk, pos); pos += chunk.byteLength; }
  return { body: new TextDecoder().decode(all), response };
}
function patternRegex(pattern, warnings, provider, field) {
  if (!pattern) return null;
  try {
    let src = Array.isArray(pattern) ? pattern.join('|') : s(pattern);
    let flags = '';
    if (src.includes('(?i)') || src.includes('(?i:')) {
      src = src.replace(/\(\?i\)/g, '').replace(/\(\?i:/g, '(?:');
      flags = 'i';
    }
    return new RegExp(src, flags);
  } catch {
    warnings.push({ code: 'PROVIDER_FILTER_INVALID', provider, field, detail: 'Invalid provider filter; treating as a fatal error.' });
    throw new Error('Invalid proxy-provider regex in ' + provider + ': ' + field);
  }
}
export async function resolveProxyProviders(clash, warnings = []) {
  if (!clash || typeof clash !== 'object') throw new Error('Clash source must be a YAML object.');
  const definitions = clash['proxy-providers'] || {};
  const keys = Object.keys(definitions);
  if (!keys.length) return clash;
  const groups = Array.isArray(clash['proxy-groups']) ? clash['proxy-groups'] : [];
  const used = new Set(groups.flatMap(g => Array.isArray(g.use) ? g.use.map(name) : []));
  const includeAll = groups.some(g => g['include-all'] || g['include-all-proxies']);
  const outputProxies = Array.isArray(clash.proxies) ? [...clash.proxies] : [];
  const existing = new Set(outputProxies.map(p => name(p.name)));
  const members = new Map();
  for (const providerName of keys) {
    if (!used.has(providerName) && !includeAll) continue;
    const provider = definitions[providerName] || {};
    let source;
    if (name(provider.type) === 'inline') source = provider.payload;
    else if (name(provider.type) === 'http') {
      try {
        const headers = { 'accept': 'text/yaml,text/plain,*/*' };
        for (const [key, value] of Object.entries(provider.header || {})) {
          if (/^(host|cookie|authorization|user-agent|accept)$/i.test(key)) headers[key] = Array.isArray(value) ? s(value[0]) : s(value);
        }
        const result = await fetchBounded(provider.url, { headers, maxBytes: 5 * 1024 * 1024 });
        const parsed = parse(result.body);
        source = Array.isArray(parsed) ? parsed : parsed?.proxies;
      } catch (error) {
        if (!Array.isArray(provider.payload)) throw new Error('Proxy provider ' + providerName + ' failed: ' + error.message);
        warnings.push({ code: 'PROXY_PROVIDER_FALLBACK', provider: providerName, detail: 'HTTP source unavailable; embedded payload was used.' });
        source = provider.payload;
      }
    } else if (name(provider.type) === 'file' && Array.isArray(provider.payload)) {
      warnings.push({ code: 'PROXY_PROVIDER_LOCAL_FILE_FALLBACK', provider: providerName, detail: 'Worker cannot read local files; embedded payload was used.' });
      source = provider.payload;
    } else throw new Error('Unsupported referenced proxy-provider: ' + providerName);
    if (!Array.isArray(source)) throw new Error('Proxy provider ' + providerName + ' has no proxies array.');
    const prefix = s(provider.override?.['additional-prefix']);
    const suffix = s(provider.override?.['additional-suffix']);
    const include = patternRegex(provider.filter, warnings, providerName, 'filter');
    const exclude = patternRegex(provider['exclude-filter'], warnings, providerName, 'exclude-filter');
    const excludeTypes = new Set(s(provider['exclude-type']).split('|').map(x => x.trim().toLowerCase()).filter(Boolean));
    const names = [];
    for (const item of source) {
      if (!item || typeof item !== 'object') continue;
      const proxy = { ...item, ...Object.fromEntries(Object.entries(provider.override || {}).filter(([key]) => !['additional-prefix', 'additional-suffix', 'proxy-name', 'override-expr'].includes(key))) };
      proxy.name = prefix + name(proxy.name) + suffix;
      if (!proxy.name || (include && !include.test(proxy.name)) || (exclude && exclude.test(proxy.name)) || excludeTypes.has(name(proxy.type).toLowerCase())) continue;
      if (existing.has(proxy.name)) {
        warnings.push({ code: 'PROVIDER_NAME_COLLISION', provider: providerName, detail: 'A duplicate node name was skipped.' });
        continue;
      }
      existing.add(proxy.name);
      names.push(proxy.name);
      outputProxies.push(proxy);
    }
    members.set(providerName, names);
  }
  return {
    ...clash,
    proxies: outputProxies,
    'proxy-groups': groups.map(group => {
      if (!Array.isArray(group.use) || !group.use.length) return group;
      const explicit = Array.isArray(group.proxies) ? group.proxies : [];
      return { ...group, proxies: [...explicit, ...group.use.flatMap(key => members.get(key) || [])] };
    })
  };
}
