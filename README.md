# Clash2Loon Worker

一个运行在 Cloudflare Workers 上的 Clash / Mihomo → Loon 动态配置转换器。

> Public edition: the repository contains **no real subscription URL, access token, deployment domain, proxy credential, private plugin URL, or personal Loon configuration**.

## 主要能力

- 将 Clash / Mihomo YAML 转换为 Loon Remote Configuration
- 支持 VLESS、VLESS Reality、VLESS WebSocket、Trojan、Hysteria2
- 将 `dialer-proxy` 转为 Loon Proxy Chain
- 保留 Clash YAML 中的节点、策略组、规则和 FINAL / MATCH 逻辑
- 大节点列表通过 `/nodes` + Loon `NameRegex` Remote Filter 引用，避免主配置过大
- 对完全相同的节点定义进行精确去重，并自动修复策略组引用
- 支持 Rule Provider 代理与文本格式转换
- 支持 `source / performance / balanced / battery` 四种测速档位
- 支持可选的 Loon Base 合并，保留 General / Host / Rewrite / Script / Plugin / Mitm 等原生能力
- 支持通过环境变量持久注入自定义插件，而不把插件列表写进代码仓库
- 自动为当前 Worker 域名加入自更新所需的绕过项
- 提供 `/status` 诊断输出与回归测试

## 设计原则

### Clash YAML 是业务逻辑权威来源

以下内容以 Clash / Mihomo YAML 为准：

- 节点
- 策略组
- 代理链
- Rule Provider
- 规则
- MATCH / FINAL

Worker 不会擅自重新设计你的策略组。

### Loon Base 只负责 Loon 原生运行时能力

以下内容由 Loon Base 负责：

- General
- Host
- Rewrite
- Script
- Plugin
- Mitm

如果不设置 `LOON_BASE_URL`，会使用仓库内置的最小化中性 Base。

## 快速开始

### 1. Fork / Clone

```bash
git clone https://github.com/fxwl/clash2loon.git
cd clash2loon
npm install
```

### 2. 准备 Cloudflare Worker Secrets

必须配置：

```text
CLASH_URL
ACCESS_TOKEN
```

其中：

- `CLASH_URL`：完整 Clash / Mihomo YAML 订阅地址
- `ACCESS_TOKEN`：保护 Worker 输出接口的随机长 token

可选变量见：

```text
.dev.vars.example
```

### 3. 本地开发

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars` 已被 `.gitignore` 忽略，不要提交真实值。

### 4. 部署到 Cloudflare Workers

```bash
npx wrangler secret put CLASH_URL
npx wrangler secret put ACCESS_TOKEN
npm run deploy
```

详细步骤见：[`docs/DEPLOY.md`](docs/DEPLOY.md)

## Loon 使用

部署后，假设 Worker 地址是：

```text
https://your-worker.example.workers.dev
```

完整配置：

```text
https://your-worker.example.workers.dev/loon?token=YOUR_TOKEN
```

节点订阅：

```text
https://your-worker.example.workers.dev/nodes?token=YOUR_TOKEN
```

状态诊断：

```text
https://your-worker.example.workers.dev/status?token=YOUR_TOKEN
```

健康检查：

```text
https://your-worker.example.workers.dev/health
```

Loon 导入与使用建议见：[`docs/LOON.md`](docs/LOON.md)

## Endpoints

| Endpoint | 说明 | 鉴权 |
| --- | --- | --- |
| `/health` | Worker 健康检查 | 否 |
| `/loon` | 完整 Loon 配置 | 是 |
| `/nodes` | Loon 节点订阅 | 是 |
| `/status` | 转换状态、warnings、统计 | 是 |
| `/rule/:name` | Rule Provider 转换结果 | 是 |
| `/inline/:index` | 内联规则远程化 | 是 |

鉴权支持：

```text
?token=YOUR_TOKEN
```

或：

```http
Authorization: Bearer YOUR_TOKEN
```

## Power Profile

`POWER_PROFILE` 只改变 Loon `url-test` 的后台测速间隔，不改变 YAML 的节点归属和分流逻辑。

| 档位 | 说明 |
| --- | --- |
| `source` | 使用 YAML 原始 interval |
| `performance` | 更频繁测速 |
| `balanced` | 平衡延迟与功耗 |
| `battery` | 最省电，默认推荐 |

当前公开默认值：

```text
POWER_PROFILE=battery
```

具体策略见：[`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)

## 自定义插件

公开版**默认不内置任何插件清单**。

如果希望 Worker 每次生成配置时自动注入自己的 Loon 插件，请设置：

```text
MANAGED_PLUGINS_JSON
```

示例：

```json
[
  "https://example.com/plugin-a.lpx, enabled=true",
  "https://example.com/plugin-b.lpx, policy=MyProxy, enabled=false"
]
```

推荐把它设置为 Cloudflare Secret，而不是写进 GitHub。

## Control-plane 资源策略

某些插件源、规则源或资源站可能在 Loon 开启时需要指定代理策略。公开版不会内置任何域名。

可选配置：

```text
CONTROL_PLANE_POLICY=MyProxyGroup
CONTROL_PLANE_DOMAINS=resources.example.com,=exact.example.net
```

规则会插入到 FINAL 前：

```text
DOMAIN-SUFFIX,resources.example.com,MyProxyGroup
DOMAIN,exact.example.net,MyProxyGroup
```

策略组必须真实存在于你的上游 YAML。

## 安全与隐私

不要提交：

- Clash / Mihomo 真实订阅 URL
- Proxy UUID / password / Reality key 等真实凭据
- Worker `ACCESS_TOKEN`
- 自定义域名中包含的私人信息
- 私人插件 token
- 生成后的 `/nodes` 或 `.lcf`

仓库已经忽略常见本地敏感文件。

完整安全说明见：[`SECURITY.md`](SECURITY.md)

## 测试

```bash
npm install
npm run test:regression
```

使用自己的测试 YAML：

```bash
npm test -- /path/to/clash.yaml
```

注意：不要把真实测试 YAML 提交到仓库。

## 文档

- [部署指南](docs/DEPLOY.md)
- [配置项说明](docs/CONFIGURATION.md)
- [Loon 使用指南](docs/LOON.md)
- [架构与数据流](docs/ARCHITECTURE.md)
- [故障排查](docs/TROUBLESHOOTING.md)
- [安全策略](SECURITY.md)
- [贡献指南](CONTRIBUTING.md)
- [测试说明](TEST_REPORT.md)

## 已知限制

- 不会尝试支持所有 Clash 协议；当前重点是 VLESS / Trojan / Hysteria2
- Mihomo 部分专有参数在 Loon 没有一一对应能力，会被省略并产生 warning
- `PROCESS-NAME` 等仅桌面环境适用的规则不会强行映射到 iOS
- Binary `.mrs` Rule Provider 只有在能推导文本 sibling 时才能转换
- Loon 与 Mihomo 的语义不是完全等价，建议先通过 `/status` 检查 warnings

## License

MIT License. See [`LICENSE`](LICENSE).

## Disclaimer

This project is a configuration conversion and deployment utility. Users are responsible for complying with the terms of service, laws, licenses, and network policies applicable to their own subscriptions and resources.
