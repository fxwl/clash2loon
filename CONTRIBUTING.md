# Contributing

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

Thanks for considering a contribution.

## Development setup

```bash
git clone https://github.com/fxwl/clash2loon.git
cd clash2loon
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Use only synthetic test data in commits.

## Before submitting a change

Run:

```bash
npm run test:regression
```

If your change affects protocol conversion, also test with a sanitized fixture that contains no real credentials.

## Pull request expectations

A useful pull request should explain:

1. The Loon or Mihomo behavior being changed.
2. The compatibility problem being solved.
3. Any parameters that are intentionally dropped or approximated.
4. Test coverage added or updated.
5. Whether the change can affect existing generated configurations.

## Privacy rules

Do not submit:

- real subscription URLs
- real node credentials
- private Worker domains
- access tokens
- private plugin tokens
- screenshots containing secrets
- generated production configs

Replace them with:

- `example.com`
- RFC 5737 documentation IPv4 ranges (`192.0.2.0/24`, etc.)
- synthetic UUIDs
- dummy passwords
- generic policy names

## Style

- Prefer conservative conversions over guessing undocumented Loon behavior.
- Emit warnings when an input field cannot be mapped safely.
- Keep Clash YAML authoritative for routing and policy membership.
- Avoid silently rewriting a user's business routing strategy.
- Preserve stable output where possible.

## Adding protocol support

When adding a protocol or transport:

1. Add a converter function.
2. Add strict synthetic fixtures.
3. Document unsupported fields.
4. Verify that `/nodes` output is accepted by Loon.
5. Add regression tests before changing production behavior.

## Third-party integrations

Do not add a third-party plugin list, personal rule set, subscription service, or private infrastructure endpoint as a default. Optional integrations should be configurable by environment variables or user-owned Loon Base files.
