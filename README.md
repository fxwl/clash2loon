# Clash2Loon Worker

[English](README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/fxwl/clash2loon/actions/workflows/ci.yml/badge.svg)](https://github.com/fxwl/clash2loon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

A dynamic Clash / Mihomo → Loon configuration converter designed to run on Cloudflare Workers.

> The public edition contains **no real subscription URL, access token, deployment domain, proxy credential, private plugin URL, or personal Loon configuration**.

## Features

- Convert Clash / Mihomo YAML into a Loon Remote Configuration.
- Support VLESS, VLESS Reality, VLESS WebSocket, Trojan, and Hysteria2.
- Convert `dialer-proxy` relationships into Loon Proxy Chains.
- Preserve YAML-defined nodes, policy groups, rules, Rule Providers, and MATCH / FINAL semantics.
- Keep successfully converted nodes inline in Loon `[Proxy]`; small and medium groups stay inline, while oversized order-safe node runs are compacted through exact local `NameRegex` filters.
- Expand Mihomo dynamic groups using `include-all` / `include-all-proxies`, `filter`, and `exclude-filter` over successfully converted nodes.
- Provide per-group `/status` diagnostics plus a `?compact=off` compatibility fallback.
- Deduplicate only nodes whose effective definitions are exactly identical, then repair group references automatically.
- Convert and proxy supported Rule Providers.
- Provide `source`, `performance`, `balanced`, and `battery` URL-test power profiles.
- Merge an optional Loon-native base while preserving General / Host / Rewrite / Script / Plugin / Mitm sections.
- Persist custom Loon plugins through an environment variable instead of committing them to GitHub.
- Add the current Worker hostname to self-bypass settings so Loon can refresh its own configuration more reliably.
- Provide `/status` diagnostics, warnings, statistics, and a regression test suite.

## Design Principles

### Clash / Mihomo YAML owns business routing

The upstream YAML is authoritative for:

- proxies;
- proxy groups;
- proxy chains;
- Rule Providers;
- rules;
- MATCH / FINAL.

Clash2Loon does not redesign your policy topology.

### Loon Base owns Loon-native runtime features

The Loon base owns:

- General;
- Host;
- Rewrite;
- Script;
- Plugin;
- Mitm.

If `LOON_BASE_URL` is not configured, Clash2Loon uses the minimal neutral base included in this repository.

## Quick Start

### 1. Clone

```bash
git clone https://github.com/fxwl/clash2loon.git
cd clash2loon
npm install
```

### 2. Configure required Cloudflare Worker secrets

Required:

```text
CLASH_URL
ACCESS_TOKEN
```

Where:

- `CLASH_URL` is the full URL of your Clash / Mihomo YAML subscription.
- `ACCESS_TOKEN` is a long random token protecting generated endpoints.

Optional variables are documented in `.dev.vars.example`.

### 3. Local development

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars` is ignored by Git. Never commit real values.

### 4. Deploy to Cloudflare Workers

```bash
npx wrangler secret put CLASH_URL
npx wrangler secret put ACCESS_TOKEN
npm run deploy
```

See the complete guide in [docs/DEPLOY.md](docs/DEPLOY.md).

## Deploy with AI

You can ask an AI coding agent or assistant to walk you through the entire deployment while keeping secrets out of Git.

Use the ready-to-copy prompt:

- [AI deployment prompt — English](docs/AI_DEPLOYMENT_PROMPT.md)
- [AI 部署提示词 — 简体中文](docs/AI_DEPLOYMENT_PROMPT.zh-CN.md)

The prompt instructs the AI to verify prerequisites, configure Cloudflare safely, deploy the Worker, validate `/health` and `/status`, and produce the final Loon URL without committing your private subscription or tokens.

## Loon URLs

Assume your deployed Worker is:

```text
https://your-worker.example.workers.dev
```

Complete Loon configuration:

```text
https://your-worker.example.workers.dev/loon?token=YOUR_TOKEN
```

Node subscription:

```text
https://your-worker.example.workers.dev/nodes?token=YOUR_TOKEN
```

Diagnostics:

```text
https://your-worker.example.workers.dev/status?token=YOUR_TOKEN
```

Health check:

```text
https://your-worker.example.workers.dev/health
```

See [docs/LOON.md](docs/LOON.md) for import and operating guidance.

## Endpoints

| Endpoint | Purpose | Authentication |
| --- | --- | --- |
| `/health` | Worker health check | No |
| `/loon` | Complete Loon configuration | Yes |
| `/nodes` | Converted Loon node subscription | Yes |
| `/status` | Conversion statistics and warnings | Yes |
| `/rule/:name` | Converted Rule Provider | Yes |
| `/inline/:index` | Remote form of an inline rule | Yes |

Authentication can be supplied using:

```text
?token=YOUR_TOKEN
```

or:

```http
Authorization: Bearer YOUR_TOKEN
```

## Hybrid Group Compilation

v1.5.21 uses a hybrid compiler for policy-group membership:

- successfully converted nodes are emitted directly into `[Proxy]`;
- groups with fewer than 64 concrete nodes and shorter than 2048 member bytes stay fully inline;
- oversized, order-safe node runs are replaced with exact local `NameRegex` filter references;
- repeated node sets reuse the same generated filters;
- custom or reversed node ordering stays inline instead of being reordered;
- `/nodes` remains available for diagnostics and isolated node feeds, but `/loon` no longer depends on a `[Remote Proxy]` subscription.

For compatibility testing, disable group compaction per request:

```text
https://YOUR-WORKER/loon?token=YOUR_TOKEN&compact=off
```

The same parameter can be used with `/status` to inspect the all-inline fallback.

## Power Profiles

`POWER_PROFILE` changes only the background `url-test` interval. It does not change which nodes belong to a group or how your YAML routes traffic.

| Profile | Behavior |
| --- | --- |
| `source` | Keep YAML intervals |
| `performance` | More frequent health checks |
| `balanced` | Moderate background checks |
| `battery` | Long intervals for lower battery use; recommended default |

Public default:

```text
POWER_PROFILE=battery
```

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Managed Plugins

The public edition ships with **no built-in plugin catalog**.

To inject your own persistent Loon plugin list, configure:

```text
MANAGED_PLUGINS_JSON
```

Example:

```json
[
  "https://example.com/plugin-a.lpx, enabled=true",
  "https://example.com/plugin-b.lpx, policy=MyProxy, enabled=false"
]
```

Prefer storing this as a Cloudflare Secret rather than committing it to GitHub.

## Control-plane Resource Routing

Some plugin, rule, or resource hosts may need a specific proxy policy while Loon is enabled. The public edition does not hard-code any such domain.

Optional configuration:

```text
CONTROL_PLANE_POLICY=MyProxyGroup
CONTROL_PLANE_DOMAINS=resources.example.com,=exact.example.net
```

Generated rules are inserted before FINAL:

```text
DOMAIN-SUFFIX,resources.example.com,MyProxyGroup
DOMAIN,exact.example.net,MyProxyGroup
```

`CONTROL_PLANE_POLICY` must match a real group in your upstream YAML.

## Security and Privacy

Never commit:

- real Clash / Mihomo subscription URLs;
- proxy UUIDs, passwords, Reality keys, or other credentials;
- Worker `ACCESS_TOKEN` values;
- private plugin tokens;
- generated `/nodes` output or `.lcf` files;
- private deployment metadata you do not want to publish.

Common local sensitive files are ignored by `.gitignore`.

See [SECURITY.md](SECURITY.md).

## Testing

```bash
npm install
npm run test:regression
```

To test your own YAML locally:

```bash
npm test -- /path/to/clash.yaml
```

Do not commit your real test YAML.

## Documentation

- [Deployment guide](docs/DEPLOY.md)
- [Configuration reference](docs/CONFIGURATION.md)
- [Loon usage guide](docs/LOON.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [AI deployment prompt](docs/AI_DEPLOYMENT_PROMPT.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Validation notes](TEST_REPORT.md)
- [Changelog](CHANGELOG.md)

## Known Limitations

- The converter intentionally does not attempt to support every Clash protocol. The current focus is VLESS, Trojan, and Hysteria2.
- Some Mihomo-specific fields have no one-to-one Loon equivalent and are omitted with warnings.
- Desktop-only rules such as `PROCESS-NAME` are not force-mapped to iOS.
- Binary `.mrs` Rule Providers can only be converted when a known text sibling can be derived.
- Loon and Mihomo semantics are not perfectly equivalent; review `/status` warnings after changing upstream configuration.

## License

MIT License. See [LICENSE](LICENSE).

## Disclaimer

This project is a configuration conversion and deployment utility. Users are responsible for complying with the terms of service, laws, licenses, and network policies applicable to their own subscriptions and resources.
