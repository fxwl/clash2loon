# Cloudflare Workers 部署指南

[English](DEPLOY.md) | [简体中文](DEPLOY.zh-CN.md)

本指南用于在**不把个人配置写入 GitHub** 的前提下部署 Clash2Loon。

## 前置条件

- Cloudflare 账号
- Node.js 20 或更高版本
- npm
- 有效的 Clash / Mihomo YAML 订阅地址
- iOS / iPadOS 上的 Loon

## 1. 克隆仓库

```bash
git clone https://github.com/fxwl/clash2loon.git
cd clash2loon
npm install
```

## 2. 检查 `wrangler.jsonc`

公开版默认值刻意保持通用：

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

你可以在本地或 Cloudflare Dashboard 中修改非敏感变量。

不要把订阅地址或 Token 写进这个文件。

## 3. 登录 Wrangler

```bash
npx wrangler login
```

## 4. 配置必需 Secrets

### `CLASH_URL`

```bash
npx wrangler secret put CLASH_URL
```

按提示输入完整的 Clash / Mihomo YAML 上游地址。

### `ACCESS_TOKEN`

先生成随机 Token：

```bash
openssl rand -hex 32
```

然后保存：

```bash
npx wrangler secret put ACCESS_TOKEN
```

## 5. 可选 Secrets / 变量

### `LOON_BASE_URL`

当你维护自己的 Loon 原生 Base 配置时使用：

```bash
npx wrangler secret put LOON_BASE_URL
```

如果未配置，项目会使用内置的最小化中性 Base。

### `MANAGED_PLUGINS_JSON`

用于持久保存自己的插件清单，而无需提交到 GitHub：

```bash
npx wrangler secret put MANAGED_PLUGINS_JSON
```

示例：

```json
[
  "https://example.com/plugin-a.lpx, enabled=true",
  "https://example.com/plugin-b.lpx, policy=MyProxy, enabled=false"
]
```

### 控制面资源

如果某些规则源、插件源或资源站需要走 YAML 中的特定代理组：

```text
CONTROL_PLANE_POLICY=MyProxy
CONTROL_PLANE_DOMAINS=resources.example.com,=exact.example.net
```

以 `=` 开头的域名会生成精确 `DOMAIN` 规则；其他条目生成 `DOMAIN-SUFFIX` 规则。

## 6. 部署

```bash
npm run deploy
```

Wrangler 上传 Worker 之前，`predeploy` 会先物化生成源码、执行语法检查，并运行完整回归测试。

## 7. 验证

打开：

```text
https://YOUR-WORKER.workers.dev/health
```

预期返回结构：

```json
{
  "ok": true,
  "service": "clash2loon",
  "time": "..."
}
```

然后检查需要鉴权的状态接口：

```text
https://YOUR-WORKER.workers.dev/status?token=YOUR_TOKEN
```

这个 URL 包含访问 Token，不要公开分享。

## 8. 可选自定义域名

你可以在 Cloudflare Workers 设置中绑定自定义域名。

Worker 会从当前请求推导自己的 Base URL，因此生成的 `/nodes`、`/rule/*` 和 `/inline/*` 地址会自动使用实际访问 `/loon` 时的域名。

合并层还会把当前 Worker 主机名加入 Loon 的自绕过配置，从而降低远程配置更新时再次递归经过 Loon 自身的概率。

## 9. Git 集成

你可以把 GitHub 仓库连接到 Cloudflare Workers Builds。

推荐生产部署命令：

```bash
npm run deploy
```

不要使用只上传版本、却没有把生产流量切换到新版本的命令。

## 10. 本地开发

```bash
cp .dev.vars.example .dev.vars
```

在 `.dev.vars` 中填写合成测试值或仅本地使用的真实值，然后运行：

```bash
npm run dev
```

`.dev.vars` 已被 Git 忽略。

## 更新项目

典型更新流程：

```bash
git pull
npm install
npm run test:regression
npm run deploy
```

部署会改变转换语义的版本前，请先阅读 Release Notes / Changelog。
