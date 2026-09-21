# Architecture

[English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.zh-CN.md)

## High-level flow

```text
Clash / Mihomo YAML
        |
        v
Cloudflare Worker
        |
        +-- parse YAML
        +-- validate / deduplicate nodes
        +-- convert supported node protocols
        +-- convert proxy groups
        +-- convert Rule Providers
        +-- apply power profile
        +-- merge optional Loon-native base
        +-- inject optional managed plugins
        |
        v
Loon Remote Configuration
```

## Endpoints

### `/loon`

Produces the complete Loon Remote Configuration.

It contains:

- General from the Loon base
- Remote Proxy referencing `/nodes`
- Remote Filters for exact node membership
- Proxy Groups derived from YAML
- Proxy Chains derived from `dialer-proxy`
- FINAL and Remote Rules derived from YAML
- optional Loon-native sections from the base
- optional managed plugins

### `/nodes`

Returns converted node definitions only.

Optional query parameters help isolate parser problems:

```text
type
limit
offset
```

Supported type selectors include protocol/subtype and landing/regular node categories.

### `/rule/:name`

Fetches and normalizes one upstream Rule Provider.

The main Loon config references this endpoint instead of forcing Loon to understand every Clash provider format directly.

### `/inline/:index`

Turns inline Clash rules into remote Loon rules where appropriate.

### `/status`

Returns diagnostic metadata, conversion statistics and warnings.

### `/health`

Simple unauthenticated health check. It does not read the upstream subscription.

## Source layout

```text
source-parts/
  converter/
  index/

scripts/materialize.mjs

src/
  base-loon.js
  base-merge.js
  managed-plugins.js
  converter.js   # generated, gitignored
  index.js       # generated, gitignored
```

`src/converter.js` and `src/index.js` are materialized before development, testing and deployment.

## Why source parts exist

The materialization layer keeps generated runtime files reproducible while applying a small number of compatibility patches in one place.

The deployment pipeline always materializes before syntax checks and regression tests.

## Ownership model

A core design rule prevents accidental configuration drift.

### Clash / Mihomo owns

```text
Proxy
Remote Proxy
Proxy Chain
Remote Filter
Proxy Group
Rule
Remote Rule
```

### Loon Base owns

```text
General
Host
Rewrite
Script
Plugin
Mitm
```

Unknown Loon sections are preserved.

## Node deduplication

The deduplicator serializes the full proxy object after removing only `name`.

This intentionally avoids heuristic deduplication by IP or server address.

Example:

```text
same server + same port + different UUID
```

is not a duplicate.

Only completely identical effective proxy definitions are collapsed.

## Linked nodes and hybrid policy-group compilation

Every successfully converted node is served by `/nodes` and loaded by Loon through `[Remote Proxy]` as `C2L_Nodes`. The main `/loon` configuration does not embed converted nodes in local `[Proxy]`.

Policy groups are compiled conservatively:

1. Dynamic Mihomo membership (`include-all` / `include-all-proxies`, `filter`, `exclude-filter`) is resolved against successfully converted nodes and valid proxy chains.
2. Every linked node referenced by a policy group is represented by a source-scoped exact `NameRegex` Remote Filter.
3. Order-safe contiguous node runs are grouped into chunked Remote Filters to reduce configuration size.
4. If a run is not compatible with global node order, each node receives its own exact filter so YAML ordering is preserved.
5. Exact `NameRegex` Remote Filters are scoped to `C2L_Nodes`, chunked, and cached so repeated node sets reuse the same generated filter set.
6. `compact=off` forces the exact-per-node filter path while retaining `C2L_Nodes` remote delivery.

`/nodes` is now part of the normal `/loon` runtime path. Refreshing `C2L_Nodes` updates the linked node set, so upstream removals do not need to be maintained as local `[Proxy]` entries.

## Power tuning

Power profiles impose minimum/maximum url-test intervals without changing policy membership.

This means battery tuning modifies when Loon tests nodes, not which nodes belong to which group.

## Rule conversion

Rule Providers are fetched by the Worker, normalized, then served to Loon.

This allows the Worker to:

- convert YAML payload arrays;
- normalize domain and CIDR behavior;
- derive known text siblings for some `.mrs` layouts;
- reject unsupported binary formats explicitly.

## Self-host bypass

The Worker knows the hostname used to request `/loon`.

During Loon-base merge, that hostname is appended to selected General settings so the app can refresh its own configuration without unnecessarily routing the Worker request back through itself.

## Security boundary

The Worker receives real subscription data at runtime but the public repository does not need to contain any of it.

Secrets live in:

- Cloudflare Worker Secrets; or
- local `.dev.vars` during development.

Generated outputs and local fixtures are gitignored.
