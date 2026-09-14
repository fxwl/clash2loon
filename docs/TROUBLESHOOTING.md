# Troubleshooting

[English](TROUBLESHOOTING.md) | [简体中文](TROUBLESHOOTING.zh-CN.md)

This guide focuses on separating Worker, upstream-subscription and Loon-client problems quickly.

## 1. Start with `/health`

Open:

```text
https://YOUR-WORKER/health
```

Expected:

```json
{
  "ok": true,
  "service": "clash2loon",
  "time": "..."
}
```

If `/health` does not open, the problem is not your Clash YAML. Check:

- Worker deployment status
- custom-domain binding
- DNS / TLS
- Cloudflare route configuration
- whether the current deployment actually serves production traffic

## 2. Then check `/status`

Open:

```text
https://YOUR-WORKER/status?token=YOUR_TOKEN
```

If `/health` works but `/status` fails, common causes are:

- wrong `ACCESS_TOKEN`
- missing `CLASH_URL`
- upstream URL returning non-YAML content
- upstream HTTP error
- unsupported or malformed YAML
- a conversion exception

Review the returned `error` or `warnings` rather than changing Loon first.

## 3. `/nodes` works but `/loon` fails

This usually points to a main-config merge or policy-generation issue rather than node conversion.

Check:

- invalid policy references
- oversized lines
- malformed Remote Filter syntax
- custom Loon Base content
- plugin lines injected through `MANAGED_PLUGINS_JSON`

Temporarily unset optional configuration and retry with the neutral embedded base.

## 4. `/loon` works in Safari but Loon cannot refresh it

Possible causes:

- Loon is routing the Worker request back through itself
- a custom domain has unusual DNS/TLS behavior
- the request is intercepted by a plugin/rewrite

The generated config automatically adds the current Worker hostname to self-bypass settings.

For first-time recovery, turn Loon off, update the remote configuration once, then enable Loon again.

## 5. Remote plugin/rule resources fail while Loon is enabled

Do not hard-code third-party domains into the project.

Instead configure:

```text
CONTROL_PLANE_POLICY=YourProxyGroup
CONTROL_PLANE_DOMAINS=resources.example.com,=exact.example.net
```

The policy group must exist in the upstream YAML.

Use `DOMAIN-SUFFIX` style entries for an entire host family and prefix a domain with `=` when an exact host match is required.

## 6. Loon crashes while importing nodes

Use `/nodes` isolation parameters.

Examples:

```text
/nodes?token=...&type=trojan
/nodes?token=...&type=hysteria2
/nodes?token=...&type=vless-reality
/nodes?token=...&offset=0&limit=50
```

This helps identify a protocol or individual node range that Loon cannot parse.

## 7. A node exists upstream but is missing in Loon

Check `/status` for:

- `PROXY_TYPE_UNSUPPORTED`
- node conversion warnings
- exact deduplication statistics

Exact deduplication removes only nodes whose complete source configuration is identical except for name.

If two nodes differ in UUID, password, UDP, transport, TLS, Reality or another field, they should remain separate.

## 8. Policy group lost nodes

Inspect generated Remote Filters.

Clash2Loon compacts concrete node runs into exact-name `NameRegex` filters. Named groups and built-in policies are kept in YAML order.

If an upstream group references an unknown member, `/status` reports `GROUP_MEMBER_NOT_FOUND`.

## 9. Rule Provider fails

Check the provider type:

- plain text: supported
- YAML payload: supported
- binary `.mrs`: only supported when a known text sibling can be derived

Look for warnings such as:

```text
MRS_SOURCE_UNMAPPED
RULE_PROVIDER_MISSING
```

## 10. Plugin policy changed unexpectedly

When a managed plugin contains:

```text
policy=SomeGroup
```

but `SomeGroup` does not exist in the YAML-derived policies, the merge layer remaps it to FINAL and emits `LOON_NATIVE_POLICY_REMAPPED`.

Fix the plugin line or upstream YAML rather than relying on the automatic fallback.

## 11. High battery usage

Use:

```text
POWER_PROFILE=battery
```

Then inspect `/status` to confirm effective url-test intervals.

The battery profile changes test frequency only; it does not change group membership or routing policy.

If battery use is still high, review Loon scripts, rewrites, MITM scope and third-party plugins separately. Those are outside the converter's url-test tuning.

## 12. Apple Watch / system-service issues

The merge layer includes narrow APNs/local-discovery compatibility guards.

If an Apple service still fails:

1. reproduce with optional plugins disabled;
2. inspect Loon request logs;
3. avoid routing all of Apple's address space through a single forced policy;
4. prefer a narrow domain/range exception.

## 13. WebRTC still exposes a local/public address

The neutral base includes:

```text
disable-stun = true
udp-fallback-mode = REJECT
```

These are privacy-oriented defaults, not a universal browser privacy guarantee.

WebRTC behavior depends on the browser, OS, network and site implementation. Test separately and avoid assuming that DNS or HTTP proxy results prove WebRTC isolation.

## 14. Deployment succeeded but production still serves an older build

Make sure your CI/CD command actually deploys production traffic.

Recommended:

```bash
npm run deploy
```

After deployment, re-check `/health` and `/status` before troubleshooting Loon.

## 15. Safe diagnostic information for issues

When opening an issue, provide:

- project version
- warning codes
- protocol type
- sanitized group structure
- sanitized error message

Do not provide:

- real subscription URLs
- tokens
- UUIDs/passwords
- private Worker domains
- full generated configs
- private plugin URLs
