# AI-assisted Deployment Prompt

[English](AI_DEPLOYMENT_PROMPT.md) | [简体中文](AI_DEPLOYMENT_PROMPT.zh-CN.md)

This page contains a ready-to-copy prompt for deploying Clash2Loon with an AI assistant or coding agent.

It is designed for tools such as ChatGPT, Codex, Claude, or another agent that can inspect a GitHub repository and optionally operate Cloudflare or a terminal.

## How to use

1. Open your preferred AI assistant.
2. Give it access to this repository if your client supports GitHub connections.
3. If your AI client supports a Cloudflare connection, connect your Cloudflare account before starting.
4. Copy the prompt below into the AI conversation.
5. Provide private values only when the AI reaches the corresponding secret-configuration step.
6. Never paste a secret into a public issue, commit, screenshot, or shared log.

## Ready-to-copy prompt

```text
I want you to deploy the open-source Clash2Loon project from:
https://github.com/fxwl/clash2loon

to my Cloudflare Workers account and help me finish the Loon setup.

Work as a deployment engineer. Read the repository first, especially:
- README.md
- docs/DEPLOY.md
- docs/CONFIGURATION.md
- docs/LOON.md
- docs/TROUBLESHOOTING.md
- SECURITY.md
- .dev.vars.example
- wrangler.jsonc

Deployment goals:
1. Deploy the current main branch to Cloudflare Workers.
2. Keep all private values out of Git and out of repository files.
3. Configure the required secrets safely:
   - CLASH_URL: my complete Clash / Mihomo YAML subscription URL.
   - ACCESS_TOKEN: a strong random token protecting generated endpoints.
4. Use POWER_PROFILE=battery unless I explicitly request another profile.
5. Do not add a private plugin list unless I ask for one.
6. Do not invent CONTROL_PLANE_POLICY or CONTROL_PLANE_DOMAINS. Configure them only if I provide a valid YAML proxy-group name and domains that need special routing.
7. Keep the upstream Clash / Mihomo YAML authoritative for nodes, proxy groups, Rule Providers, rules, and FINAL / MATCH logic.

Security requirements:
- NEVER commit CLASH_URL, ACCESS_TOKEN, proxy credentials, private plugin URLs, private domains, generated node lists, or generated Loon configs to GitHub.
- NEVER place secrets in wrangler.jsonc, README files, source files, tests, issue text, commit messages, or screenshots.
- Do not echo a secret back to me after I provide it.
- Prefer Cloudflare Worker Secrets for sensitive values.
- If using a terminal, use commands such as `wrangler secret put` so the secret is entered interactively rather than embedded in shell history where practical.
- Keep `.dev.vars` local and untracked.
- If a requested action could expose a secret, stop and explain the safer alternative.

Execution mode:
- If you have authorized GitHub and Cloudflare tools, inspect and perform the deployment directly.
- If you have terminal access with Node.js/npm, you may clone the repository and use Wrangler.
- If you cannot perform a step directly, give me the exact Cloudflare Dashboard or CLI step, wait for my result, and continue from there.
- Do not claim a deployment succeeded until you actually verify it.

Required procedure:
A. Inspect the repository and summarize the deployment architecture in a few sentences.
B. Check prerequisites: Cloudflare account access, Node.js >= 20 if using CLI, npm, and Wrangler availability.
C. Run the repository regression suite before deployment:
   `npm install`
   `npm run test:regression`
   Do not continue with production deployment if the tests fail; diagnose first.
D. Configure CLASH_URL as a Cloudflare Secret. Ask me to enter it only when needed.
E. Generate or configure ACCESS_TOKEN as a Cloudflare Secret. Prefer at least 32 random bytes. Do not print the final token in logs after it is set.
F. Review non-sensitive variables in wrangler.jsonc. Keep POWER_PROFILE=battery by default.
G. Deploy production traffic using:
   `npm run deploy`
   Do not use an upload-only command that leaves production traffic on an older version.
H. Verify the unauthenticated endpoint:
   `https://<worker-host>/health`
   It must return HTTP 200 with `ok: true`.
I. Verify the authenticated status endpoint:
   `https://<worker-host>/status?token=<ACCESS_TOKEN>`
   Check `ok`, conversion statistics, warnings, finalPolicy, converted node count, and merged configuration statistics.
J. If `/status` returns warnings, explain which warnings are expected compatibility warnings and which need action. Do not silently ignore conversion failures.
K. Verify `/nodes` and `/loon` return successful responses. Do not paste their full bodies into a public log because they may contain private proxy information.
L. Give me the final Loon remote configuration URL in this form:
   `https://<worker-host>/loon?token=<ACCESS_TOKEN>`
   Treat that URL as sensitive because it contains the access token.
M. Explain how to add it to Loon and how to refresh the configuration.
N. If I use a custom domain, verify `/health` and `/status` on that custom domain before recommending it for Loon.
O. At the end, provide a short deployment checklist containing only statuses and endpoint names, not secret values.

Troubleshooting rules:
- If `/health` fails, diagnose Worker deployment, custom-domain binding, DNS, TLS, or production routing before changing Clash YAML.
- If `/health` works but `/status` fails, check ACCESS_TOKEN, CLASH_URL, upstream HTTP response, YAML validity, and conversion errors.
- If `/nodes` works but `/loon` fails, inspect merge logic, policy references, Remote Filter syntax, optional Loon Base content, and plugin configuration.
- If Safari can access `/loon` but Loon cannot refresh it while enabled, inspect self-routing/TUN behavior and follow the repository troubleshooting guide.
- If a plugin or rule resource fails only while Loon is enabled, use CONTROL_PLANE_POLICY and CONTROL_PLANE_DOMAINS only when a valid YAML policy group and required resource domain are known.
- Do not solve an isolated compatibility problem by forcing all Apple, GitHub, CDN, or international traffic through one policy.

Before you start, tell me which execution mode you can actually use:
1. GitHub + Cloudflare connected tools,
2. terminal + Wrangler,
3. guided manual Cloudflare Dashboard steps.
Then begin with repository inspection and prerequisite checks.
```

## What the AI should eventually produce

A successful assisted deployment should end with:

- regression tests passed;
- Worker deployed to production;
- `CLASH_URL` stored as a secret;
- `ACCESS_TOKEN` stored as a secret;
- `/health` verified;
- `/status` verified;
- `/nodes` verified without exposing its contents;
- `/loon` verified without exposing its contents;
- a private Loon remote-configuration URL supplied to the user;
- any conversion warnings explained.

## Recommended follow-up prompt

After deployment, you can ask:

```text
Review my Clash2Loon /status output. Explain every warning, identify which ones are harmless compatibility notices, and tell me which ones require configuration changes. Do not ask me to paste node credentials or the full generated /nodes output.
```
