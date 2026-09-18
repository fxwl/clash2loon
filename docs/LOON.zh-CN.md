# Loon 使用指南

[English](LOON.md) | [简体中文](LOON.zh-CN.md)

## 导入生成后的配置

部署完成后，Worker 会提供：

```text
/loon?token=YOUR_TOKEN
```

把完整 HTTPS URL 作为 Loon 的远程配置源。

示例：

```text
https://your-worker.example.workers.dev/loon?token=YOUR_TOKEN
```

## 推荐的首次 Loon 初始化流程

Worker 部署完成后，建议按下面顺序完成新设备上的 Loon 初始化。

1. **导入订阅/配置**：将 Clash2Loon 生成的 `/loon?token=...` 地址导入 Loon。
2. 导入完成后，点击 [切换至自动分流模式](https://www.nsloon.com/openloon/flowmodel=filter)，将 Loon 切换为 **自动分流 / Filter** 模式。
3. 再点击 [切换代理模式至 TUN Only](https://www.nsloon.com/openloon/proxymode=tun)。点击后跳转到 Loon 即代表该切换操作已执行。
4. 打开 Loon 中 **MitM、脚本、复写** 三个功能开关。
5. 进入 **MitM**，打开 **MitM over HTTP/2** 和 **QUIC 回退保护**。
6. 确保 **Safari 是系统默认浏览器**，然后安装 Loon CA 证书，并在 iOS 设置中完成证书信任。
7. 按自己的 Loon 使用方式添加所需订阅。对于 Clash2Loon 完整 `/loon?token=...` 配置，请特别注意下面的说明，通常不需要再次手工添加生成的 `/nodes` 地址。
8. 点击 Loon 底部导航栏的 **配置** → 右上角 **⋯** → 打开 **始终开启**。
9. 打开 Loon 总开关后，点击 [一键更新所有外部资源](https://www.nsloon.com/openloon/update?sub=all)，统一更新订阅、规则、插件、脚本及其他外部资源。
10. 等待所有资源更新完成后，回到仪表界面，将 Loon 总开关关闭再重新打开一次，使新的配置和资源完整重新加载。

> **Clash2Loon 特别说明：**完整 `/loon?token=...` 配置已经在 `[Proxy]` 中包含所有成功转换的节点。正常情况下不需要再手工添加生成的 `/nodes` 地址；`/nodes` 仅作为可选的独立节点订阅和诊断接口保留。

> **证书安全说明：**安装并信任 MitM 证书后，已启用的 MitM / Rewrite / Script 能够检查受支持的 HTTPS 流量。只应对你信任的配置和第三方插件启用 MitM。

## 节点订阅

`/nodes?token=YOUR_TOKEN` 仍然保留，可作为独立节点订阅，用于诊断、协议隔离或其他客户端消费。

当你使用 `/loon` 作为完整远程配置时，通常不需要再手工添加 `/nodes`。v1.5.21 会把成功转换的节点直接写入 `[Proxy]`，不再依赖 `[Remote Proxy]`。

## 为什么节点现在直接写入主配置

节点 Inline 可以避免主配置在运行时依赖第二份节点订阅，也能让静态策略组和动态展开策略组的成员更加确定。

为了避免超大型 `[Proxy Group]` 单行过长，Clash2Loon 使用混合编译：

1. 小型和中型策略组直接列真实节点名；
2. 超大型且顺序安全的连续节点段可以使用精确本地 `NameRegex` Filter；
3. 相同节点集合复用同一套 Filter；
4. 自定义排序或倒序保持 Inline。

如需兼容性基线，可在 `/loon` 后追加 `&compact=off`，强制所有策略组成员使用 Inline。

## 更新外部资源

刷新主远程配置时，Loon 会直接请求 Worker 主机。

生成后的 `[General]` 会把当前 Worker 主机名加入自绕过设置，减少 Loon 开启时更新配置出现递归分流问题的概率。

如果某个独立插件源、规则源或资源站在 Loon 开启时必须通过特定代理更新，可以配置：

```text
CONTROL_PLANE_POLICY
CONTROL_PLANE_DOMAINS
```

不要把第三方资源域名直接写死到公开仓库源码中。

## Loon Base

公开版内置 Base 故意保持最小化。

如果需要更高级的 Loon 原生能力，例如：

- Rewrite
- Script
- Plugin
- Mitm
- 自定义 Host
- 自定义 General

建议维护自己的 Loon Base，并配置 `LOON_BASE_URL`。

YAML 生成的节点和分流区段仍然拥有各自区段的优先权。

## 插件持久化

如果希望每次重新生成 `/loon` 时自己的插件仍然存在，可以配置 `MANAGED_PLUGINS_JSON`。

示例：

```json
[
  "https://example.com/plugin.lpx, enabled=true"
]
```

公开项目不会内置默认插件清单。

## 省电模式

如果手机长期保持 Loon 开启，建议从下面的配置开始：

```text
POWER_PROFILE=battery
```

它会降低后台 `url-test` 探测频率，但不会改变原始策略组成员或分流逻辑。

## Apple 系统服务兼容

合并层会把少量 APNs 网段和本地发现目标加入 `skip-proxy` 与 `bypass-tun`，同时让 `*.apple.com` / `*.icloud.com` 使用 real IP 处理。

该策略故意保持窄范围，并不会强制整个 Apple 地址空间全部 DIRECT。

## WebRTC / STUN

中性 Base 包含：

```text
disable-stun = true
udp-fallback-mode = REJECT
```

这些是偏隐私的默认设置，但并不保证所有浏览器和应用在任何 WebRTC 场景中都完全隐藏本地或公网地址。

如果 WebRTC 隐私对你很重要，请在自己的真实网络环境中单独验证。

## 常用验收流程

导入 `/loon` 后：

1. 在浏览器打开 `/status?token=...`。
2. 确认 `ok: true`。
3. 检查 `warnings`。
4. 检查节点数量和去重统计。
5. 确认 Loon 内策略组结构与 YAML 预期一致。
6. 每种实际使用的协议至少测试一个节点。
7. 如果配置了远程规则和插件，再测试对应资源更新。

## 不要公开生成后的 URL

包含 `?token=...` 的 URL 本身就是凭据。不要把它粘贴到公开 Issue、截图或文档中。
