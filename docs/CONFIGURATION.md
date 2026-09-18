# Configuration Reference

[English](CONFIGURATION.md) | [简体中文](CONFIGURATION.zh-CN.md)

## Required Worker Secrets

### `CLASH_URL`

Full URL of the upstream Clash / Mihomo YAML document.

Example placeholder:

```text
https://example.com/subscription.yaml
```

Do not commit the real value.

### `ACCESS_TOKEN`

Protects all generated configuration and diagnostic endpoints except `/health`.

Recommended: 32 random bytes or stronger.

## Optional Worker variables

### `LOON_BASE_URL`

Remote Loon base configuration.

When configured, the Worker uses the remote Loon-native sections as the base and overlays generated Clash-owned sections.

If fetching fails, the embedded neutral base is used as fallback and a warning is emitted.

### `MANAGED_PLUGINS_JSON`

JSON array of Loon plugin lines.

Example:

```json
[
  "https://example.com/plugin-a.lpx, enabled=true",
  "https://example.com/plugin-b.lpx, policy=ProxyGroup, enabled=false"
]
```

Default:

```json
[]
```

The public project intentionally ships no plugin catalog.

### `POWER_PROFILE`

Supported values:

- `source`
- `performance`
- `balanced`
- `battery`

#### source

Keeps the original YAML `interval` values.

#### performance

Prioritizes responsiveness and caps url-test intervals at a relatively short value.

#### balanced

Uses moderate minimum intervals.

#### battery

Uses long minimum intervals to reduce periodic background network probes.

Current battery targets:

| Group category | Minimum interval |
| --- | ---: |
| primary auto | 3600 s |
| region | 7200 s |
| low-rate | 14400 s |
| home/broadband | 7200 s |
| other | 10800 s |

Classification is name-based and conservative. If a group does not match a known category, it is treated as `other`.

### `CACHE_TTL`

Cache duration in seconds for generated `/loon`, `/nodes`, `/status`, and inline outputs.

Default:

```text
300
```

### `RULE_CACHE_TTL`

Cache duration for converted Rule Provider output.

Default:

```text
3600
```

### `CONTROL_PLANE_POLICY`

Optional upstream YAML proxy-group name for resource/control-plane traffic.

The Worker only enables this feature when the named group actually exists in the YAML.

### `CONTROL_PLANE_DOMAINS`

Comma-separated list of domains that should use `CONTROL_PLANE_POLICY`.

Example:

```text
resources.example.com,=exact.example.net
```

Conversion:

```text
resources.example.com  -> DOMAIN-SUFFIX
=exact.example.net     -> DOMAIN
```

Generated rules are inserted before FINAL.

## Ownership model

### YAML-owned sections

- Proxy
- Remote Proxy
- Proxy Chain
- Remote Filter
- Proxy Group
- Rule
- Remote Rule

### Loon-base-owned sections

- General
- Host
- Rewrite
- Script
- Plugin
- Mitm

Unknown sections from the Loon base are preserved.

## Managed plugin behavior

When `MANAGED_PLUGINS_JSON` is present, the generated `[Plugin]` section is built from that array.

If a plugin line contains `policy=...` and the referenced policy does not exist in the generated YAML-derived policies, the merge layer remaps it to the YAML FINAL policy and emits a warning.

## Node deduplication

The converter computes an exact fingerprint from the proxy object excluding only the `name` field.

Two nodes are deduplicated only when all effective source configuration fields are identical.

If two nodes share an IP but differ in UUID, password, UDP behavior, SNI, transport, Reality parameters, or any other field, they are not collapsed.

Group references to a removed duplicate are remapped to the first retained node.

## Inline nodes and hybrid group compaction

Successfully converted nodes are emitted directly in `[Proxy]`.

Small and medium proxy groups reference those node names directly. Oversized, order-safe node runs may be represented by exact local `NameRegex` filters to prevent very long `[Proxy Group]` lines.

Default thresholds:

- group eligibility: at least 64 concrete nodes or 2048 inline member bytes;
- run eligibility: at least 16 nodes or 512 bytes;
- custom/reversed ordering: remains inline.

Generated filters are exact-name filters and identical node sets are reused. No `[Remote Proxy]` source is required.

The `/nodes` endpoint is still available as a standalone node feed and diagnostic surface.

## Runtime query parameter: `compact`

Group compaction is enabled by default. To temporarily force all policy-group members inline, use any false value:

```text
/loon?token=YOUR_TOKEN&compact=off
/status?token=YOUR_TOKEN&compact=off
```

Accepted false values are `0`, `false`, `off`, and `no`.

This is a per-request compatibility switch, not a Worker environment variable.

## Rule Provider conversion

The Worker can proxy/normalize text and YAML Rule Providers.

Binary `.mrs` providers are not decoded directly. For known MetaCubeX layouts, the converter attempts to derive a text sibling URL. Otherwise the provider is marked unsupported.

## Warnings

Inspect `/status` after changing configuration. Warnings are intentionally preferred over silent guessing when Mihomo and Loon semantics do not map one-to-one.
