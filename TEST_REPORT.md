# Validation Notes

[English](TEST_REPORT.md) | [简体中文](TEST_REPORT.zh-CN.md)

This document describes the public regression scope. It intentionally contains no real subscription URLs, node credentials, deployment domains, account identifiers, or production data.

## Covered conversion behavior

- VLESS, including Reality and WebSocket transports
- Trojan
- Hysteria2
- `dialer-proxy` to Loon proxy chains
- Clash/Mihomo proxy groups to Loon policy groups
- Rule Provider conversion and Worker-hosted remote rules
- Exact-name `NameRegex` filters for large node sets
- Stable `/nodes` remote subscription output
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

- base/Clash ownership rules
- remote filter syntax and ordering
- select-group ordering
- node deduplication
- battery/balanced/source interval behavior
- managed plugin injection
- cache/config wiring
- Apple system-service compatibility guards

## Test data policy

All committed fixtures use reserved/example domains, documentation IP ranges, synthetic UUIDs and dummy credentials. Never commit a real Clash subscription, proxy credential, Worker token, private plugin URL, or generated node list.
