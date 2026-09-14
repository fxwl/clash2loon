# Security Policy

## Scope

Clash2Loon processes network subscription data that may contain proxy credentials. Treat your deployment as sensitive infrastructure.

## Never commit secrets

Do not commit any of the following to GitHub:

- Real Clash / Mihomo subscription URLs
- Worker access tokens
- Proxy UUIDs, passwords, Reality keys or certificates
- Private plugin URLs or plugin tokens
- Private custom domains if they identify your deployment
- Generated node lists or generated Loon configuration files

Use Cloudflare Worker Secrets or local `.dev.vars` instead.

## Recommended secrets

Required:

```text
CLASH_URL
ACCESS_TOKEN
```

Optional sensitive configuration:

```text
LOON_BASE_URL
MANAGED_PLUGINS_JSON
```

Depending on your setup, `CONTROL_PLANE_DOMAINS` may also reveal private infrastructure; store it as a Secret if necessary.

## Access token

Use a long random value for `ACCESS_TOKEN`. Avoid dictionary words or reused passwords.

Example generation command:

```bash
openssl rand -hex 32
```

Do not place the token in screenshots, issue reports or public logs.

## Endpoint exposure

Only `/health` is intentionally unauthenticated.

The following endpoints require `ACCESS_TOKEN`:

- `/loon`
- `/nodes`
- `/status`
- `/rule/*`
- `/inline/*`

## Generated configuration

Generated Loon output may contain:

- node credentials
- upstream policy names
- subscription metadata
- private resource URLs

Treat generated files as secrets unless you have deliberately sanitized them.

## Reporting a vulnerability

Do not open a public issue containing credentials, tokens, private subscription URLs or exploitable deployment details.

When reporting a security problem, remove all secrets and replace private values with synthetic examples such as `example.com`, documentation IP ranges, and dummy UUIDs.

## Third-party resources

This project does not bundle a default plugin catalog. If you configure external plugins, rules, parsers or data files, review their licenses and security implications independently.
