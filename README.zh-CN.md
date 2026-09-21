# Clash2Loon Worker

一个运行在 Cloudflare Workers 上的 Clash / Mihomo → Loon 动态配置转换器。

[English](README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/fxwl/clash2loon/actions/workflows/ci.yml/badge.svg)](https://github.com/fxwl/clash2loon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

## 致谢与灵感来源

Clash2Loon 最初是在我长期使用 Loon 的过程中，受到 [可莉的 Loon 指南与 ProxyResource](https://github.com/luestr/ProxyResource) 启发而开发的。我自己也一直在使用其中整理的 Loon 相关资源。

感谢可莉长期以来对 Loon 配置、插件及相关资源的整理、维护与分享。

如果你有 **Loon 插件**方面的需求，可以前往 [ProxyResource](https://github.com/luestr/ProxyResource) 查看。


## 主要能力

- 将 Clash / Mihomo YAML 转换为 Loon Remote Configuration。
- 支持 VLESS、VLESS Reality、VLESS WebSocket、Trojan、Hysteria2、SOCKS5（`socks` / `socks5`）。
- 将 `dialer-proxy` 转换为 Loon Proxy Chain，包括 SOCKS5 落地节点。
- 保留 YAML 中定义的节点、策略组、规则、Rule Provider 和 MATCH / FINAL 逻辑。
- 成功转换的节点通过 `/nodes` 作为 `C2L_Nodes` `[Remote Proxy]` 链接节点加载；策略组中引用的所有链接节点都会通过限定 `C2L_Nodes` 来源的精确 `NameRegex` Remote Filter 进入策略。
- 支持 Mihomo 动态策略组：`include-all` / `include-all-proxies`、`filter`、`exclude-filter`，且只会从成功转换的节点中展开。
- `/status` 提供组级诊断，并支持 `?compact=off` 切换为逐节点精确 Remote Filter 兼容模式。
- 仅对有效配置完全一致的节点进行精确去重，并自动修复策略组引用。
- 转换并代理支持的 Rule Provider。
- 提供 `source / performance / balanced / battery` 四种测速功耗档位。
- 支持合并可选的 Loon Base，保留 General / Host / Rewrite / Script / Plugin / Mitm 等原生能力。
- 可通过环境变量持久注入自己的 Loon 插件，而无需写进 GitHub。
- 自动将当前 Worker 域名加入自更新绕过项，提高 Loon 开启时刷新配置的稳定性。
- 提供 `/status` 诊断、warning、统计信息和完整回归测试。

## 设计原则

### Clash / Mihomo YAML 是业务分流的权威来源

以下内容以 YAML 为准：

- 节点；
- 策略组；
- 代理链；
- Rule Provider；
- 规则；
- MATCH / FINAL。

Clash2Loon 不会擅自重新设计你的策略拓扑。

### Loon Base 负责 Loon 原生运行能力

Loon Base 负责：

- General；
- Host；
- Rewrite；
- Script；
- Plugin；
- Mitm。

如果没有配置 `LOON_BASE_URL`，会使用仓库内置的最小化中性 Base。

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/fxwl/clash2loon.git
cd clash2loon
npm install
```

### 2. 配置 Cloudflare Worker Secrets

必须配置：

```text
CLASH_URL
ACCESS_TOKEN
```

其中：

- `CLASH_URL`：完整 Clash / Mihomo YAML 订阅地址。
- `ACCESS_TOKEN`：保护 Worker 生成接口的随机长 Token。

其他可选变量见 `.dev.vars.example`。

### 3. 本地开发

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars` 已被 Git 忽略，请勿提交真实值。

### 4. 部署到 Cloudflare Workers

```bash
npx wrangler secret put CLASH_URL
npx wrangler secret put ACCESS_TOKEN
npm run deploy
```

完整步骤见 [中文部署指南](docs/DEPLOY.zh-CN.md)。

## 使用 AI 部署

如果不想自己逐步配置，可以直接让 ChatGPT、Codex、Claude 等 AI 编程助手协助完成部署，同时要求它严格避免把订阅地址和 Token 写进 Git。

可直接复制下面的提示词：

- [AI Deployment Prompt — English](docs/AI_DEPLOYMENT_PROMPT.md)
- [AI 部署提示词 — 简体中文](docs/AI_DEPLOYMENT_PROMPT.zh-CN.md)

提示词会要求 AI：检查环境、配置 Cloudflare、创建 Secrets、部署 Worker、验证 `/health` 和 `/status`，最后生成可导入 Loon 的地址，同时明确禁止把私人订阅和 Token 提交到仓库。

## Loon 地址

假设部署后的 Worker 地址是：

```text
https://your-worker.example.workers.dev
```

完整 Loon 配置：

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

Loon 导入、首次初始化和使用建议见 [中文 Loon 使用指南](docs/LOON.zh-CN.md)。

## Endpoints

| Endpoint | 说明 | 鉴权 |
| --- | --- | --- |
| `/health` | Worker 健康检查 | 否 |
| `/loon` | 完整 Loon 配置 | 是 |
| `/nodes` | Loon 节点订阅 | 是 |
| `/status` | 转换统计和 warnings | 是 |
| `/rule/:name` | Rule Provider 转换结果 | 是 |
| `/inline/:index` | 内联规则的远程化结果 | 是 |

鉴权可以使用：

```text
?token=YOUR_TOKEN
```

或者：

```http
Authorization: Bearer YOUR_TOKEN
```

## 混合策略组编译

v1.5.24 改为“链接节点 + 混合策略组编译”：

- 所有成功转换的节点由 `/nodes` 提供，并通过 `[Remote Proxy]` 以 `C2L_Nodes` 链接节点加载；
- 主 `/loon` 配置不再把转换节点写入本地 `[Proxy]`；
- 策略组中所有链接节点都通过限定 `C2L_Nodes` 来源的精确 `NameRegex` Remote Filter 引用；
- 顺序安全的连续节点段会合并并分块，减少 Filter 数量；
- 相同节点集合会复用同一组 Filter；
- 自定义排序、倒序等场景会退化为逐节点精确 Filter，从而保持 YAML 顺序；
- 上游删除节点后，刷新链接节点订阅即可从 `/nodes` 中同步移除，避免长期累积为 Loon 本地节点。

如需兼容性排查，可以按请求关闭策略组 Filter 压缩：

```text
https://YOUR-WORKER/loon?token=YOUR_TOKEN&compact=off
```

`/status` 也可以使用相同参数。此时仍然使用 `C2L_Nodes` 链接节点，并改为每个节点一个精确 Remote Filter，而不是合并连续节点段。

## 省电测速档位

`POWER_PROFILE` 只修改 Loon `url-test` 的后台测速间隔，不改变 YAML 中节点归属和分流逻辑。

| 档位 | 说明 |
| --- | --- |
| `source` | 使用 YAML 原始 interval |
| `performance` | 更频繁测速 |
| `balanced` | 平衡响应速度与功耗 |
| `battery` | 最长测速周期，默认推荐 |

公开版默认：

```text
POWER_PROFILE=battery
```

详见 [中文配置项说明](docs/CONFIGURATION.zh-CN.md)。

## 自定义插件

公开版**默认不内置任何插件清单**。

如需每次生成配置时自动注入自己的 Loon 插件，请配置：

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

推荐将其保存为 Cloudflare Secret，而不是提交到 GitHub。

## 控制面资源分流

部分插件源、规则源或资源站在 Loon 开启时可能需要指定代理策略。公开版不会写死任何第三方域名。

可选配置：

```text
CONTROL_PLANE_POLICY=MyProxyGroup
CONTROL_PLANE_DOMAINS=resources.example.com,=exact.example.net
```

生成后的规则会插入 FINAL 之前：

```text
DOMAIN-SUFFIX,resources.example.com,MyProxyGroup
DOMAIN,exact.example.net,MyProxyGroup
```

`CONTROL_PLANE_POLICY` 必须真实存在于上游 YAML。

## 安全与隐私

请勿提交：

- 真实 Clash / Mihomo 订阅地址；
- Proxy UUID、密码、Reality Key 等凭据；
- Worker `ACCESS_TOKEN`；
- 私人插件 Token；
- 生成后的 `/nodes` 或 `.lcf` 文件；
- 任何你不希望公开的部署信息。

仓库已经通过 `.gitignore` 忽略常见本地敏感文件。

详见 [中文安全策略](SECURITY.zh-CN.md)。

## 测试

```bash
npm install
npm run test:regression
```

使用自己的 YAML 测试：

```bash
npm test -- /path/to/clash.yaml
```

不要将真实测试 YAML 提交到仓库。

## 文档

- [部署指南](docs/DEPLOY.zh-CN.md)
- [配置项说明](docs/CONFIGURATION.zh-CN.md)
- [Loon 使用指南](docs/LOON.zh-CN.md)
- [架构与数据流](docs/ARCHITECTURE.zh-CN.md)
- [故障排查](docs/TROUBLESHOOTING.zh-CN.md)
- [AI 部署提示词](docs/AI_DEPLOYMENT_PROMPT.zh-CN.md)
- [安全策略](SECURITY.zh-CN.md)
- [贡献指南](CONTRIBUTING.zh-CN.md)
- [测试说明](TEST_REPORT.zh-CN.md)
- [更新日志](CHANGELOG.zh-CN.md)

## 友情链接 / 支持社区

- [LINUX DO](https://linux.do/)

## 已知限制

- 不会尝试支持所有 Clash 协议，目前重点是 VLESS / Trojan / Hysteria2 / SOCKS5。
- Mihomo 的部分专有字段在 Loon 中没有一一对应能力，会被省略并产生 warning。
- `PROCESS-NAME` 等桌面专用规则不会强行映射到 iOS。
- Binary `.mrs` Rule Provider 只有在可以推导出已知文本 sibling 时才能转换。
- Loon 与 Mihomo 的语义并不完全等价，修改上游配置后建议通过 `/status` 检查 warnings。

## License

MIT License，见 [LICENSE](LICENSE)。

## 免责声明

本项目只是配置转换和部署工具。用户应自行确保自己的订阅、资源和网络使用符合相关服务条款、许可协议、法律法规及网络政策。
