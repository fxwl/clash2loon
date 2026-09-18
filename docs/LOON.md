# Loon Usage Guide

[English](LOON.md) | [简体中文](LOON.zh-CN.md)

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

## Recommended first-time Loon setup

After the Worker has been deployed, the following sequence is recommended for a new Loon installation.

1. **Import your generated Clash2Loon subscription/configuration** into Loon using the Worker `/loon?token=...` URL.
2. Tap [Switch to Automatic Routing](https://www.nsloon.com/openloon/flowmodel=filter) to change Loon to **Automatic Routing / Filter** mode.
3. Tap [Switch proxy mode to TUN Only](https://www.nsloon.com/openloon/proxymode=tun). Once the link opens Loon, the mode switch should be applied.
4. Enable the **MitM**, **Script**, and **Rewrite** feature switches in Loon.
5. Under **MitM**, enable **MitM over HTTP/2** and **QUIC fallback protection**.
6. Make sure **Safari is the default browser**, then install the Loon CA certificate and trust it in iOS Settings.
7. Add your subscription as required by your Loon setup.
8. In Loon, open **Configuration** from the bottom navigation bar → tap **⋯** in the upper-right corner → enable **Always On**.
9. Turn Loon on, then tap [Update all external resources](https://www.nsloon.com/openloon/update?sub=all) to refresh subscriptions, rules, plugins, scripts, and other external resources in one operation.
10. After all resources finish updating, return to the Loon dashboard and toggle Loon off and back on once so the refreshed configuration is fully reloaded.

> **Clash2Loon note:** when you import the complete `/loon?token=...` configuration, it already references `/nodes?token=...` through `[Remote Proxy]`. You normally do **not** need to manually add the generated `/nodes` URL again, otherwise you may end up with duplicate node sources.

> **Certificate note:** installing and trusting the MitM certificate allows enabled MitM/Rewrite/Script features to inspect supported HTTPS traffic. Only enable MitM for configurations and third-party plugins you trust.

## Node subscription

`/nodes?token=YOUR_TOKEN` remains available as a standalone node feed for diagnostics, protocol isolation, or other consumers.

When using `/loon` as the complete remote configuration, you normally do not need to add `/nodes` separately. v1.5.21 emits successfully converted nodes directly into `[Proxy]` and does not require `[Remote Proxy]`.

## Why nodes are inline in the main config

Keeping nodes inline avoids runtime dependence on a second node subscription and makes static or dynamically expanded groups deterministic.

To prevent very large `[Proxy Group]` lines, Clash2Loon uses hybrid compilation:

1. small and medium groups list concrete node names directly;
2. oversized, order-safe node runs can use exact local `NameRegex` filters;
3. identical node sets reuse the same filters;
4. custom or reversed ordering stays inline.

If you need a compatibility baseline, append `&compact=off` to `/loon` to force all policy-group members inline.

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
