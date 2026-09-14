# Changelog

[English](CHANGELOG.md) | [简体中文](CHANGELOG.zh-CN.md)

All notable public changes to Clash2Loon are documented here.

This project follows a pragmatic versioning model while the converter is still evolving. Compatibility changes that may affect generated Loon configuration are called out explicitly.

## [Unreleased]

### Planned

- Expand sanitized protocol fixtures and compatibility coverage.
- Improve documentation for additional Loon-native base configurations.
- Continue conservative protocol support without guessing undocumented Loon behavior.

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
