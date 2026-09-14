# 安全策略

[English](SECURITY.md) | [简体中文](SECURITY.zh-CN.md)

## 适用范围

Clash2Loon 会处理可能包含代理凭据的网络订阅数据。请把你的部署视为敏感基础设施。

## 永远不要提交 Secrets

不要把以下内容提交到 GitHub：

- 真实 Clash / Mihomo 订阅 URL
- Worker 访问 Token
- Proxy UUID、密码、Reality Key 或证书
- 私人插件 URL 或插件 Token
- 能识别你部署环境的私人自定义域名
- 生成后的节点列表或 Loon 配置文件

应使用 Cloudflare Worker Secrets 或本地 `.dev.vars`。

## 推荐的 Secrets

必需：

```text
CLASH_URL
ACCESS_TOKEN
```

可选敏感配置：

```text
LOON_BASE_URL
MANAGED_PLUGINS_JSON
```

根据你的实际部署，`CONTROL_PLANE_DOMAINS` 也可能暴露私人基础设施；如有需要，请同样保存为 Secret。

## Access Token

`ACCESS_TOKEN` 应使用足够长的随机值，不要使用字典词、常用密码或重复密码。

示例生成命令：

```bash
openssl rand -hex 32
```

不要把 Token 放进截图、Issue、公开日志或文档。

## Endpoint 暴露范围

只有 `/health` 设计为免鉴权。

以下接口需要 `ACCESS_TOKEN`：

- `/loon`
- `/nodes`
- `/status`
- `/rule/*`
- `/inline/*`

## 生成后的配置

生成的 Loon 输出可能包含：

- 节点凭据
- 上游策略名称
- 订阅元数据
- 私有资源地址

除非已经主动完成脱敏，否则应把生成文件视为敏感信息。

## 漏洞报告

不要创建包含凭据、Token、私人订阅 URL 或可被直接利用的部署细节的公开 Issue。

报告安全问题时，请移除所有 Secrets，并使用 `example.com`、文档保留 IP 网段、虚构 UUID 等合成数据替换私人值。

## 第三方资源

本项目不会内置默认插件目录。如果你配置外部插件、规则、解析器或数据文件，请独立检查它们的许可证与安全影响。
