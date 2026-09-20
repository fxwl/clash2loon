# Validation Notes

[English](TEST_REPORT.md) | [简体中文](TEST_REPORT.zh-CN.md)

This document describes the public regression scope. It intentionally contains no real subscription URLs, node credentials, deployment domains, account identifiers, or production data.

## Covered conversion behavior

- VLESS, including Reality and WebSocket transports
- Trojan
- Hysteria2
- SOCKS5 (`socks` / `socks5`), including authenticated/TLS nodes
- `dialer-proxy` to Loon proxy chains, including SOCKS5 landing nodes
- Clash/Mihomo proxy groups to Loon policy groups
- Mihomo dynamic group expansion via `include-all` / `include-all-proxies`, `filter`, and `exclude-filter`
- Inline `[Proxy]` node delivery in the complete `/loon` config
- Hybrid large-group compaction using exact local `NameRegex` filters
- Order-safety fallback for custom/reversed group membership
- `compact=off` all-inline compatibility mode
- Per-group compaction and line-size diagnostics
- Stable standalone `/nodes` output
- Rule Provider conversion and Worker-hosted remote rules
- Exact node-definition deduplication
- Configurable power profiles for `url-test` groups
- Loon-native section preservation and stale policy remapping
- Optional managed plugins from `MANAGED_PLUGINS_JSON`
- Optional self-host bypass for Worker subscription refreshes
- Optional control-plane resource routing

## Regression suite

Run:

```bash
npm install
npm run test:regression
```

The regression suite checks:

- base/Clash ownership rules;
- small inline groups and exact YAML member ordering;
- 192-node hybrid compaction and filter reuse;
- custom/reversed-order inline fallback;
- `compact=off` all-inline fallback;
- Mihomo dynamic group expansion and exclusion of unsupported nodes;
- node deduplication;
- SOCKS5 conversion and SOCKS5 `dialer-proxy` chain generation;
- battery/balanced/source interval behavior;
- managed plugin injection;
- cache/config wiring;
- Apple system-service compatibility guards.

## Test data policy

All committed fixtures use reserved/example domains, documentation IP ranges, synthetic UUIDs and dummy credentials. Never commit a real Clash subscription, proxy credential, Worker token, private plugin URL, or generated node list.
