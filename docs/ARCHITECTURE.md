# Architecture

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

## Policy group compaction

Concrete nodes in a group are represented by generated exact-name `NameRegex` filters.

Contiguous node runs are compacted independently, preserving the relative position of named groups and built-in policies such as DIRECT or REJECT.

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
