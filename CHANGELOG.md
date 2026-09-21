# Changelog

[English](CHANGELOG.md) | [简体中文](CHANGELOG.zh-CN.md)

All notable public changes to Clash2Loon are documented here.

This project follows a pragmatic versioning model while the converter is still evolving. Compatibility changes that may affect generated Loon configuration are called out explicitly.

## [Unreleased]

### Planned

- Expand sanitized protocol fixtures and compatibility coverage.
- Improve documentation for additional Loon-native base configurations.
- Continue conservative protocol support without guessing undocumented Loon behavior.

## [1.5.24] - 2026-09-21

### Changed

- Restore linked node delivery through `[Remote Proxy]` using `C2L_Nodes = /nodes` instead of embedding converted nodes in local `[Proxy]`.
- Large, order-safe policy-group node runs now use source-scoped `NameRegex` Remote Filters against `C2L_Nodes`; small and custom-ordered groups keep direct node names.
- `compact=off` now disables only policy-group Remote Filter compaction while keeping remote node delivery enabled.
- Bump cache revision so existing v1.5.23 `/loon` and `/status` cache entries are not reused.
- Expose `/nodes?type=socks5` for SOCKS5 isolation and diagnostics.

### Why

- Linked node delivery avoids long-lived local-node accumulation in Loon when upstream nodes are removed. After migration, node lifecycle is managed by refreshing the `C2L_Nodes` subscription.

## [1.5.23] - 2026-09-20

### Added

- SOCKS5 node conversion for Mihomo `type: socks` and `type: socks5`.
- SOCKS5 authentication, TLS/SNI, `skip-cert-verify`, TCP Fast Open, and UDP mapping to documented Loon node fields.
- SOCKS5 nodes with `dialer-proxy` now participate in the existing Loon Proxy Chain conversion.
- Regression coverage for unauthenticated SOCKS, authenticated TLS SOCKS5, and SOCKS5 landing-node chains.

## [1.5.22] - 2026-09-18

### Fixed

- Stop emitting YAML-owned Loon sections when they contain no real content.
- In particular, omit empty `[Remote Proxy]` and `[Remote Filter]` placeholders so Loon does not expose a misleading linked-node category in the v1.5.21 inline-node architecture.
- Add regression coverage to ensure empty remote node/filter sections stay absent from the final configuration.

## [1.5.21] - 2026-09-18

### Added

- Mihomo dynamic policy-group expansion for `include-all` / `include-all-proxies`, `filter`, and `exclude-filter`.
- Per-group diagnostics in `/status`: source/resolved/emitted member counts, line byte length, unresolved members, compaction mode, compressed-node count, and filter-reference count.
- Per-request `compact=off` compatibility fallback for `/loon` and `/status`.
- Regression coverage for 33-node inline groups, 192-node large groups, custom/reversed ordering, dynamic groups, and the all-inline fallback.

### Changed

- Successfully converted nodes are now emitted directly into Loon `[Proxy]`; the main `/loon` configuration no longer depends on `[Remote Proxy]`.
- Small and medium groups remain fully inline.
- Oversized, order-safe node runs use exact local `NameRegex` filters only when compaction is needed.
- Large-group compaction starts at 64 concrete nodes or 2048 inline member bytes; eligible runs require at least 16 nodes or 512 bytes.
- Identical node sets reuse generated filters.
- Custom or reversed node ordering remains inline to preserve YAML ordering semantics.
- Dynamic groups expand only from successfully converted nodes and valid chains, preventing unsupported proxy definitions from re-entering policy groups.
- `/nodes` remains available as an independent node feed and diagnostic endpoint.

### Compatibility

- Existing public environment-driven features such as `MANAGED_PLUGINS_JSON`, `CONTROL_PLANE_POLICY`, and `CONTROL_PLANE_DOMAINS` remain unchanged.
- No production subscription URL, access token, private deployment domain, or private plugin configuration is included in this release.

## [1.5.16] - 2026-09-14

### Added

- Initial public release with a clean Git history separated from the private production repository.
- Clash / Mihomo YAML → Loon Remote Configuration conversion.
- VLESS, VLESS Reality, VLESS WebSocket, Trojan, and Hysteria2 support.
- `dialer-proxy` → Loon Proxy Chain conversion.
- `/loon`, `/nodes`, `/status`, `/rule/:name`, `/inline/:index`, and `/health` endpoints.
- Exact node-definition deduplication with group-reference repair.
- Remote node delivery through `/nodes` and exact-name `NameRegex` filters.
- Rule Provider conversion and Worker-hosted rule output.
- `source`, `performance`, `balanced`, and `battery` URL-test power profiles.
- Optional `LOON_BASE_URL` support for Loon-native sections.
- Optional `MANAGED_PLUGINS_JSON` plugin persistence without committing private plugin lists.
- Optional `CONTROL_PLANE_POLICY` and `CONTROL_PLANE_DOMAINS` resource-routing overrides.
- Worker self-host bypass handling for remote configuration refreshes.
- Apple system-service compatibility guards kept intentionally narrow.
- Regression tests and GitHub Actions CI.
- Security, deployment, configuration, architecture, Loon usage, and troubleshooting documentation.
- English default README with Simplified Chinese README.
- Ready-to-copy AI-assisted deployment prompts in English and Simplified Chinese.
- Complete English and Simplified Chinese project documentation set.

### Privacy and Security

- No real subscription URL, access token, proxy credential, private plugin URL, private deployment domain, or generated production configuration is included in the public repository.
- Common local secret/configuration files are excluded through `.gitignore`.
- Sensitive runtime values are designed to be supplied through Cloudflare Worker Secrets or local `.dev.vars`.

### Known Compatibility Notes

- Some Mihomo-specific fields have no documented Loon equivalent and are omitted with warnings.
- Hysteria2 port hopping is not force-mapped when there is no documented Loon equivalent.
- `PROCESS-NAME` is not force-converted for Loon on iOS.
- Binary `.mrs` Rule Providers require a known text sibling mapping.
- Loon and Mihomo semantics are not perfectly equivalent; `/status` warnings should be reviewed after upstream configuration changes.
