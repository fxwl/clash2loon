# Cloudflare Workers Deployment Guide

[English](DEPLOY.md) | [简体中文](DEPLOY.zh-CN.md)

This guide deploys Clash2Loon without storing personal configuration in GitHub.

## Prerequisites

- A Cloudflare account
- Node.js 20 or newer
- npm
- A valid Clash / Mihomo YAML subscription URL
- Loon on iOS / iPadOS

## 1. Clone the repository

```bash
git clone https://github.com/fxwl/clash2loon.git
cd clash2loon
npm install
```

## 2. Review `wrangler.jsonc`

The public defaults are intentionally generic:

```json
{
  "vars": {
    "CACHE_TTL": "300",
    "RULE_CACHE_TTL": "3600",
    "POWER_PROFILE": "battery",
    "CONTROL_PLANE_POLICY": "",
    "CONTROL_PLANE_DOMAINS": ""
  }
}
```

You may change non-sensitive defaults locally or through Cloudflare Dashboard variables.

Do not place subscription URLs or tokens in this file.

## 3. Authenticate Wrangler

```bash
npx wrangler login
```

## 4. Configure required secrets

### CLASH_URL

```bash
npx wrangler secret put CLASH_URL
```

Paste the full upstream Clash / Mihomo YAML URL when prompted.

### ACCESS_TOKEN

Generate a random token:

```bash
openssl rand -hex 32
```

Then save it:

```bash
npx wrangler secret put ACCESS_TOKEN
```

## 5. Optional secrets / variables

### LOON_BASE_URL

Use this when you maintain your own Loon-native base configuration:

```bash
npx wrangler secret put LOON_BASE_URL
```

If omitted, the repository uses a minimal neutral embedded base.

### MANAGED_PLUGINS_JSON

Use this to persist your own plugin list without committing it:

```bash
npx wrangler secret put MANAGED_PLUGINS_JSON
```

Value example:

```json
[
  "https://example.com/plugin-a.lpx, enabled=true",
  "https://example.com/plugin-b.lpx, policy=MyProxy, enabled=false"
]
```

### Control-plane resources

If some rule/plugin/resource hosts need a specific YAML proxy group:

```text
CONTROL_PLANE_POLICY=MyProxy
CONTROL_PLANE_DOMAINS=resources.example.com,=exact.example.net
```

A value beginning with `=` becomes an exact `DOMAIN` rule. Other values become `DOMAIN-SUFFIX` rules.

## 6. Deploy

```bash
npm run deploy
```

Before Wrangler uploads the Worker, `predeploy` materializes generated source files, runs syntax checks, and executes the regression suite.

## 7. Verify

Open:

```text
https://YOUR-WORKER.workers.dev/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "clash2loon",
  "time": "..."
}
```

Then check authenticated status:

```text
https://YOUR-WORKER.workers.dev/status?token=YOUR_TOKEN
```

Do not share this URL publicly because it contains your access token.

## 8. Optional custom domain

You may bind a custom domain in Cloudflare Workers settings.

The Worker derives its own base URL from the incoming request, so generated `/nodes`, `/rule/*`, and `/inline/*` URLs automatically use the domain that served `/loon`.

The merge layer also adds the current Worker hostname to Loon's self-bypass settings so that remote configuration refreshes are less likely to recurse through Loon itself.

## 9. Git integration

You can connect a GitHub repository to Cloudflare Workers Builds.

Recommended production command:

```bash
npm run deploy
```

Avoid deployment commands that only upload a version without routing production traffic.

## 10. Local development

```bash
cp .dev.vars.example .dev.vars
```

Fill `.dev.vars` with synthetic or local-only values, then:

```bash
npm run dev
```

`.dev.vars` is ignored by Git.

## Updating

Typical flow:

```bash
git pull
npm install
npm run test:regression
npm run deploy
```

Review release notes before deploying changes that affect conversion semantics.
