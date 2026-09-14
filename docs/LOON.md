# Loon Usage Guide

## Importing the generated configuration

After deployment, your Worker exposes:

```text
/loon?token=YOUR_TOKEN
```

Use the full HTTPS URL as a Loon remote configuration source.

Example placeholder:

```text
https://your-worker.example.workers.dev/loon?token=YOUR_TOKEN
```

## Node subscription

The main config references:

```text
/nodes?token=YOUR_TOKEN
```

through `[Remote Proxy]`.

You normally do not need to add `/nodes` manually when using `/loon` as the complete remote config.

## Why nodes are separated from the main config

Large Clash subscriptions can produce very large Loon `[Proxy]` sections and very long policy-group lines.

Clash2Loon instead:

1. publishes nodes at `/nodes`;
2. creates Loon `NameRegex` filters;
3. points YAML-derived policy groups at those filters.

This reduces duplication and makes large subscriptions more manageable.

## Updating resources

When you refresh the main remote configuration, Loon requests the Worker host directly.

The generated `[General]` includes the current Worker hostname in self-bypass settings to reduce recursive routing problems while Loon is active.

If an unrelated plugin/rule host needs a proxy to update successfully, configure:

```text
CONTROL_PLANE_POLICY
CONTROL_PLANE_DOMAINS
```

Do not hard-code such domains in the repository.

## Loon Base

The public embedded base is intentionally minimal.

For advanced Loon-native features such as:

- Rewrite
- Script
- Plugin
- Mitm
- custom Host settings
- custom General settings

maintain your own Loon base and configure `LOON_BASE_URL`.

YAML-derived node/routing sections still take precedence for their owned sections.

## Plugin persistence

If you want plugins to remain present every time `/loon` is regenerated, configure `MANAGED_PLUGINS_JSON`.

Example:

```json
[
  "https://example.com/plugin.lpx, enabled=true"
]
```

The project does not ship a default plugin list.

## Power saving

For phones that keep Loon enabled for long periods, start with:

```text
POWER_PROFILE=battery
```

This reduces the frequency of background `url-test` probes while preserving the original group membership and routing logic.

## Apple system-service compatibility

The merge layer adds a small set of APNs-related ranges and local-discovery targets to `skip-proxy` and `bypass-tun`, and keeps `*.apple.com` / `*.icloud.com` on real IP handling.

This is intentionally narrow. It does not force Apple's entire address space to DIRECT.

## WebRTC / STUN

The neutral base includes:

```text
disable-stun = true
udp-fallback-mode = REJECT
```

This is a privacy-oriented default, but it is not a guarantee that every browser or application will hide all local/public addresses in every WebRTC scenario.

Validate your own environment separately if WebRTC privacy is important.

## Common verification flow

After importing `/loon`:

1. Open `/status?token=...` in a browser.
2. Confirm `ok: true`.
3. Review `warnings`.
4. Check node counts and dedup statistics.
5. Confirm policy groups in Loon match the YAML structure you expect.
6. Test one node of each protocol type you use.
7. Test remote rule and plugin refreshes if configured.

## Do not publish generated URLs

URLs containing `?token=...` are credentials. Do not paste them into public issues, screenshots, or documentation.
