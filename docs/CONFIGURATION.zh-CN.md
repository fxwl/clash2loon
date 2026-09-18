# 配置项说明

[English](CONFIGURATION.md) | [简体中文](CONFIGURATION.zh-CN.md)

## 必需的 Worker Secrets

### `CLASH_URL`

上游 Clash / Mihomo YAML 的完整 URL。

示例占位地址：

```text
https://example.com/subscription.yaml
```

不要提交真实值。

### `ACCESS_TOKEN`

用于保护除 `/health` 以外的所有配置生成和诊断接口。

建议：至少使用 32 字节随机值。

## 可选 Worker 变量

### `LOON_BASE_URL`

远程 Loon Base 配置地址。

配置后，Worker 会把远程 Loon 原生区段作为基础，再覆盖由 Clash 生成并负责的区段。

如果拉取失败，会回退到内置的中性 Base，并产生 warning。

### `MANAGED_PLUGINS_JSON`

Loon 插件行组成的 JSON 数组。

示例：

```json
[
  "https://example.com/plugin-a.lpx, enabled=true",
  "https://example.com/plugin-b.lpx, policy=ProxyGroup, enabled=false"
]
```

默认值：

```json
[]
```

公开版刻意不内置任何插件目录。

### `POWER_PROFILE`

支持：

- `source`
- `performance`
- `balanced`
- `battery`

#### `source`

保留 YAML 原始 `interval`。

#### `performance`

优先响应速度，将 url-test 周期限制在较短范围。

#### `balanced`

使用中等的最小检测间隔。

#### `battery`

使用更长的最小检测间隔，减少后台周期性网络探测。

当前 battery 目标值：

| 策略组类别 | 最小间隔 |
| --- | ---: |
| 主自动选择 | 3600 秒 |
| 地区组 | 7200 秒 |
| 低倍率组 | 14400 秒 |
| 家宽/宽带组 | 7200 秒 |
| 其他 | 10800 秒 |

分类基于策略组名称，并采用保守判断；无法匹配已知类别时归为 `other`。

### `CACHE_TTL`

生成后的 `/loon`、`/nodes`、`/status` 和 inline 输出缓存时长，单位秒。

默认：

```text
300
```

### `RULE_CACHE_TTL`

转换后的 Rule Provider 输出缓存时长。

默认：

```text
3600
```

### `CONTROL_PLANE_POLICY`

可选，用于资源/控制面流量的上游 YAML 策略组名称。

只有当该策略组确实存在于 YAML 时，Worker 才会启用此能力。

### `CONTROL_PLANE_DOMAINS`

需要使用 `CONTROL_PLANE_POLICY` 的域名列表，以逗号分隔。

示例：

```text
resources.example.com,=exact.example.net
```

转换规则：

```text
resources.example.com  -> DOMAIN-SUFFIX
=exact.example.net     -> DOMAIN
```

生成的规则会插入 FINAL 之前。

## 区段归属模型

### YAML 负责

- Proxy
- Remote Proxy
- Proxy Chain
- Remote Filter
- Proxy Group
- Rule
- Remote Rule

### Loon Base 负责

- General
- Host
- Rewrite
- Script
- Plugin
- Mitm

Loon Base 中未知的区段会被保留。

## 托管插件行为

存在 `MANAGED_PLUGINS_JSON` 时，生成后的 `[Plugin]` 会使用该数组构建。

如果插件行包含 `policy=...`，但引用的策略在 YAML 生成的策略中不存在，合并层会把它重映射到 YAML 的 FINAL 策略，并产生 warning。

## 节点去重

转换器会对代理对象计算精确指纹，仅排除 `name` 字段。

只有所有有效源配置字段完全一致的节点才会去重。

如果两个节点 IP 相同，但 UUID、密码、UDP、SNI、传输方式、Reality 参数或其他任意字段不同，都不会被合并。

被移除重复节点的策略组引用会自动重映射到第一个保留节点。

## Inline 节点与混合策略组压缩

成功转换的节点直接写入 `[Proxy]`。

小型和中型策略组直接引用这些真实节点名；只有超大型、且节点顺序安全的连续节点段才会使用精确本地 `NameRegex` Filter，以避免 `[Proxy Group]` 单行过长。

默认阈值：

- 策略组进入压缩候选：实体节点至少 64 个，或 Inline 成员文本达到 2048 bytes；
- 单个节点段进入压缩：至少 16 个节点，或达到 512 bytes；
- 自定义排序或倒序：保持 Inline。

生成的 Filter 使用精确节点名；相同节点集合会复用。整个过程不需要 `[Remote Proxy]` 节点源。

`/nodes` 仍保留为独立节点订阅和诊断接口。

## 运行时查询参数：`compact`

默认开启策略组压缩。如需临时强制所有策略组成员使用 Inline，可使用任意 false 值：

```text
/loon?token=YOUR_TOKEN&compact=off
/status?token=YOUR_TOKEN&compact=off
```

支持的 false 值为 `0`、`false`、`off`、`no`。

这是按请求生效的兼容性开关，不是 Worker 环境变量。

## Rule Provider 转换

Worker 可以代理并标准化文本和 YAML Rule Provider。

Binary `.mrs` 不会直接解码。对于已知的 MetaCubeX 目录结构，转换器会尝试推导文本 sibling URL；否则该 Provider 会被标记为不支持。

## Warnings

修改配置后建议检查 `/status`。当 Mihomo 与 Loon 无法一一映射时，本项目优先给出 warning，而不是静默猜测转换结果。
