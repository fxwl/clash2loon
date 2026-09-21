# 更新日志

[English](CHANGELOG.md) | [简体中文](CHANGELOG.zh-CN.md)

Clash2Loon 的公开版本重要变更记录在这里。

在转换器仍持续演进期间，本项目采用务实的版本管理方式。任何可能影响生成后 Loon 配置兼容性的改动都会明确标注。

## [Unreleased]

### 计划

- 扩展脱敏协议 fixture 与兼容性覆盖。
- 完善更多 Loon 原生 Base 配置的文档。
- 在不猜测未文档化 Loon 行为的前提下继续扩展协议支持。

## [1.5.25] - 2026-09-21

### 修复

- 修复 v1.5.24 中节点已出现在 `C2L_Nodes`，但策略组无法加载这些链接节点的问题。
- 策略组引用的所有订阅节点现在都会通过限定 `C2L_Nodes` 来源的精确 `NameRegex` Remote Filter 进入策略。
- 顺序安全的连续节点段会合并并分块；自定义排序或倒序场景会退化为逐节点精确 Filter，以保持 YAML 顺序。
- `compact=off` 现在表示使用逐节点精确 Remote Filter，而不是直接写链接节点名。
- 保留 v1.5.24 的链接节点生命周期管理，以及 SOCKS5、`dialer-proxy` 中转链、动态策略组、精确去重和功耗档位。

## [1.5.24] - 2026-09-21

### 调整

- 恢复通过 `[Remote Proxy]` 使用 `C2L_Nodes = /nodes` 的链接节点交付方式，不再把转换后的节点写入本地 `[Proxy]`。
- 超大型且顺序安全的策略组节点段改为使用限定 `C2L_Nodes` 来源的精确 `NameRegex` Remote Filter；小型和自定义排序策略组继续直接保留节点名。
- `compact=off` 现在只关闭策略组 Remote Filter 压缩，节点仍通过 `C2L_Nodes` 远程加载。
- 更新缓存版本，避免继续命中 v1.5.23 的 `/loon` 与 `/status` 缓存。
- 新增 `/nodes?type=socks5`，便于隔离测试和诊断 SOCKS5 节点。

### 原因

- 链接节点模式可以避免上游节点删除后继续长期累积在 Loon 本地节点中。迁移后，节点增删由刷新 `C2L_Nodes` 订阅统一管理。

## [1.5.23] - 2026-09-20

### 新增

- 支持 Mihomo `type: socks` 与 `type: socks5` 转换为 Loon SOCKS5 节点。
- 支持 SOCKS5 用户名/密码、TLS/SNI、`skip-cert-verify`、TCP Fast Open 与 UDP 参数映射。
- 带 `dialer-proxy` 的 SOCKS5 节点接入现有 Loon Proxy Chain 转换，可作为中转后的落地节点使用。
- 新增无认证 SOCKS、TLS 认证 SOCKS5、SOCKS5 中转链回归测试。

## [1.5.22] - 2026-09-18

### 修复

- 合并 Loon Base 时，不再输出没有实际内容的 YAML-owned 区段。
- 特别移除空的 `[Remote Proxy]` 和 `[Remote Filter]` 占位区段，避免 Loon 在 v1.5.21 Inline 节点模式下出现多余的“链接节点”分类。
- 新增回归测试，确保空远程节点/过滤器区段不会重新进入最终配置。

## [1.5.21] - 2026-09-18

### 新增

- 支持 Mihomo 动态策略组：`include-all` / `include-all-proxies`、`filter`、`exclude-filter`。
- `/status` 新增组级诊断：源成员数、已解析成员数、输出引用数、单行字节数、缺失成员、压缩模式、压缩节点数和 Filter 引用数。
- `/loon` 与 `/status` 支持按请求使用 `compact=off`，快速切回全 Inline 兼容模式。
- 增加 33 节点 Inline 组、192 节点大组、自定义/倒序、动态组以及全 Inline 回退的回归测试。

### 调整

- 所有成功转换的节点现在直接写入 Loon `[Proxy]`；主 `/loon` 配置不再依赖 `[Remote Proxy]`。
- 小型和中型策略组保持全 Inline。
- 只有超大型且顺序安全的连续节点段才使用精确本地 `NameRegex` Filter。
- 策略组达到 64 个实体节点或 2048 bytes Inline 成员文本时进入压缩候选；单个节点段至少需要 16 个节点或 512 bytes。
- 相同节点集合复用生成的 Filter。
- 自定义排序或倒序保持 Inline，避免改变 YAML 原始选择顺序。
- 动态策略组只会从成功转换的节点和有效代理链中展开，避免不支持的代理定义重新进入策略组。
- `/nodes` 继续保留为独立节点订阅和诊断接口。

### 兼容性

- `MANAGED_PLUGINS_JSON`、`CONTROL_PLANE_POLICY`、`CONTROL_PLANE_DOMAINS` 等公开版通用能力保持不变。
- 本版本不包含生产订阅地址、访问 Token、私人部署域名或私人插件配置。

## [1.5.16] - 2026-09-14

### 新增

- 首个公开版本，使用与私人生产仓库完全分离的全新 Git 历史。
- Clash / Mihomo YAML → Loon Remote Configuration 转换。
- 支持 VLESS、VLESS Reality、VLESS WebSocket、Trojan、Hysteria2。
- `dialer-proxy` → Loon Proxy Chain 转换。
- `/loon`、`/nodes`、`/status`、`/rule/:name`、`/inline/:index`、`/health` 接口。
- 精确节点定义去重，并自动修复策略组引用。
- 通过 `/nodes` 远程提供节点，并使用精确名称 `NameRegex` 过滤器。
- Rule Provider 转换与 Worker 托管规则输出。
- `source`、`performance`、`balanced`、`battery` 四种 url-test 功耗档位。
- 可选 `LOON_BASE_URL`，用于保留 Loon 原生区段。
- 可选 `MANAGED_PLUGINS_JSON`，无需把私人插件清单提交到仓库即可持久化插件。
- 可选 `CONTROL_PLANE_POLICY` 与 `CONTROL_PLANE_DOMAINS` 控制面资源分流覆盖。
- Worker 自域名绕过处理，提高远程配置刷新稳定性。
- 范围刻意保持收敛的 Apple 系统服务兼容保护。
- 回归测试和 GitHub Actions CI。
- 安全、部署、配置、架构、Loon 使用和故障排查文档。
- 默认英文 README 与简体中文 README。
- 英文和简体中文的 AI 辅助部署提示词。
- 英文与简体中文的完整项目文档体系。

### 隐私与安全

- 公开仓库不包含真实订阅 URL、访问 Token、代理凭据、私人插件 URL、私人部署域名或生产配置。
- 常见本地 Secret / 配置文件通过 `.gitignore` 排除。
- 敏感运行时值应通过 Cloudflare Worker Secrets 或本地 `.dev.vars` 提供。

### 已知兼容性说明

- 部分 Mihomo 专有字段没有文档化的 Loon 等价能力，会被省略并产生 warning。
- 当没有已知 Loon 映射时，不会强制转换 Hysteria2 port hopping。
- `PROCESS-NAME` 不会强制转换到 iOS Loon。
- Binary `.mrs` Rule Provider 需要能够推导出已知文本 sibling。
- Loon 与 Mihomo 语义并不完全等价；上游配置变化后应检查 `/status` warnings。
