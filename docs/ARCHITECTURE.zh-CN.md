# 架构说明

[English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.zh-CN.md)

## 总体流程

```text
Clash / Mihomo YAML
        |
        v
Cloudflare Worker
        |
        +-- 解析 YAML
        +-- 校验 / 去重节点
        +-- 转换支持的节点协议
        +-- 转换策略组
        +-- 转换 Rule Provider
        +-- 应用功耗档位
        +-- 合并可选 Loon 原生 Base
        +-- 注入可选托管插件
        |
        v
Loon Remote Configuration
```

## Endpoints

### `/loon`

生成完整 Loon Remote Configuration。

内容包括：

- 来自 Loon Base 的 General
- 指向 `/nodes` 的 Remote Proxy
- 用于精确节点成员匹配的 Remote Filter
- 根据 YAML 生成的 Proxy Group
- 根据 `dialer-proxy` 生成的 Proxy Chain
- 根据 YAML 生成的 FINAL 与 Remote Rule
- Base 中可选的 Loon 原生区段
- 可选托管插件

### `/nodes`

只返回转换后的节点定义。

可选查询参数可用于定位解析问题：

```text
type
limit
offset
```

支持按协议/子类型，以及 landing/regular 节点类别筛选。

### `/rule/:name`

拉取并标准化一个上游 Rule Provider。

主 Loon 配置引用该接口，从而无需强迫 Loon 原生理解每一种 Clash Provider 格式。

### `/inline/:index`

在适合的情况下，把 Clash 内联规则转换为远程 Loon 规则。

### `/status`

返回诊断元数据、转换统计和 warnings。

### `/health`

简单的免鉴权健康检查，不读取上游订阅。

## 源码结构

```text
source-parts/
  converter/
  index/

scripts/materialize.mjs

src/
  base-loon.js
  base-merge.js
  managed-plugins.js
  converter.js   # generated, gitignored
  index.js       # generated, gitignored
```

`src/converter.js` 与 `src/index.js` 会在开发、测试和部署前通过 materialize 生成。

## 为什么存在 source-parts

materialization 层使运行时生成文件可复现，同时把少量兼容性补丁集中到一个位置维护。

部署流程会始终先执行 materialize，再进行语法检查和回归测试。

## 区段归属模型

核心设计原则之一，是防止配置在合并过程中意外漂移。

### Clash / Mihomo 负责

```text
Proxy
Remote Proxy
Proxy Chain
Remote Filter
Proxy Group
Rule
Remote Rule
```

### Loon Base 负责

```text
General
Host
Rewrite
Script
Plugin
Mitm
```

Loon Base 中未知区段会被保留。

## 节点去重

去重器会对完整 proxy 对象进行序列化，仅移除 `name` 字段。

这样可以避免按 IP 或 server 地址进行启发式去重。

例如：

```text
相同 server + 相同 port + 不同 UUID
```

不属于重复节点。

只有有效代理定义完全一致时才会折叠。

## 策略组压缩

策略组中的实体节点会转换成精确节点名的 `NameRegex` 过滤器。

连续节点段会分别压缩，同时保留命名策略组以及 DIRECT / REJECT 等内置策略之间的原始相对顺序。

## 功耗调优

Power Profile 会调整 url-test 的最小/最大检测周期，但不会修改策略组成员关系。

也就是说，battery 调优改变的是 Loon **何时测速**，而不是节点**属于哪个组**。

## 规则转换

Rule Provider 由 Worker 拉取、标准化，再提供给 Loon。

因此 Worker 可以：

- 转换 YAML payload 数组；
- 标准化 domain 和 CIDR 行为；
- 为部分 `.mrs` 目录结构推导已知文本 sibling；
- 对不支持的二进制格式明确报错。

## Worker 自域名绕过

Worker 能知道请求 `/loon` 时使用的主机名。

合并 Loon Base 时，该主机名会追加到指定 General 配置中，从而使 Loon 在开启状态下刷新自身远程配置时，不必无意义地再次把 Worker 请求路由回自己。

## 安全边界

Worker 在运行时会读取真实订阅数据，但公开仓库本身不需要包含这些信息。

Secrets 应保存在：

- Cloudflare Worker Secrets；或
- 本地开发时的 `.dev.vars`。

生成结果和本地私有 fixture 都已通过 `.gitignore` 排除。
