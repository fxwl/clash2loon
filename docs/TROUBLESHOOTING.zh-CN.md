# 故障排查

[English](TROUBLESHOOTING.md) | [简体中文](TROUBLESHOOTING.zh-CN.md)

本指南用于快速区分 Worker、上游订阅和 Loon 客户端问题。

## 1. 先检查 `/health`

打开：

```text
https://YOUR-WORKER/health
```

预期：

```json
{
  "ok": true,
  "service": "clash2loon",
  "time": "..."
}
```

如果 `/health` 无法打开，问题通常不在 Clash YAML。请检查：

- Worker 部署状态
- 自定义域名绑定
- DNS / TLS
- Cloudflare 路由配置
- 当前部署是否真的承载生产流量

## 2. 再检查 `/status`

打开：

```text
https://YOUR-WORKER/status?token=YOUR_TOKEN
```

如果 `/health` 正常但 `/status` 失败，常见原因包括：

- `ACCESS_TOKEN` 错误
- 缺少 `CLASH_URL`
- 上游 URL 返回的不是 YAML
- 上游 HTTP 错误
- YAML 不支持或格式损坏
- 转换过程抛出异常

优先查看返回的 `error` 或 `warnings`，不要先去改 Loon。

## 3. `/nodes` 正常但 `/loon` 失败

这通常说明问题在主配置合并或策略组生成，而不是节点协议转换。

检查：

- 无效策略引用；
- 策略组单行过长；
- 本地 `NameRegex` Filter 语法错误；
- 自定义 Loon Base 内容；
- `MANAGED_PLUGINS_JSON` 注入的插件行。

v1.5.21 中，成功转换的节点已经直接写入 `[Proxy]`，`/loon` 不依赖 `[Remote Proxy]`。

建议检查 `/status` 中的 `maxProxyGroupLineBytes` 与 `groupDiagnostics`。如果怀疑策略组压缩兼容性，可以直接测试：

```text
/loon?token=YOUR_TOKEN&compact=off
```

如果全 Inline 回退模式正常，提交问题时同时附上正常模式和 `compact=off` 的脱敏诊断信息。

## 4. Safari 能打开 `/loon`，但 Loon 自己无法刷新

可能原因：

- Loon 把 Worker 请求再次路由回自己
- 自定义域名存在 DNS / TLS 特殊问题
- 请求被插件或 Rewrite 拦截

生成配置会自动把当前 Worker 主机名加入自绕过设置。

首次恢复时，可以先关闭 Loon，更新一次远程配置，再重新开启。

## 5. Loon 开启时远程插件/规则资源更新失败

不要把第三方域名硬编码进项目源码。

改用：

```text
CONTROL_PLANE_POLICY=YourProxyGroup
CONTROL_PLANE_DOMAINS=resources.example.com,=exact.example.net
```

策略组必须真实存在于上游 YAML。

整个域名族使用 `DOMAIN-SUFFIX` 风格；需要精确匹配时，在域名前加 `=`。

## 6. Loon 导入节点时崩溃

使用 `/nodes` 的隔离参数定位。

例如：

```text
/nodes?token=...&type=trojan
/nodes?token=...&type=hysteria2
/nodes?token=...&type=vless-reality
/nodes?token=...&offset=0&limit=50
```

这样可以判断是某种协议，还是某一段节点触发了解析问题。

## 7. 上游有节点，但 Loon 中缺失

检查 `/status` 中是否存在：

- `PROXY_TYPE_UNSUPPORTED`
- 节点转换 warnings
- 精确去重统计

精确去重只会移除除名称之外完整源配置完全一致的节点。

如果两个节点在 UUID、密码、UDP、传输方式、TLS、Reality 或任何其他字段上不同，就应该保留为两个节点。

## 8. 策略组少了节点

优先检查 `/status` 中的 `stats.groupDiagnostics`：

- `sourceMembers`：解析后的 YAML 策略组要求的成员数；
- `resolvedMembers`：能解析到已转换节点、有效策略组、代理链或内置策略的成员数；
- `emittedMembers`：最终写入 Loon 策略组行的引用数；
- `compressedNodeMembers`：由本地 Filter 表示的实体节点数；
- `filterRefs`：该组引用的生成 Filter 数；
- `compactionMode`：`inline` 或 `local-filter`；
- `lineBytes`：生成后策略组单行的 UTF-8 字节数；
- `missingMembers`：无法解析的 YAML 成员。

小型策略组保持 Inline；超大型且顺序安全的节点段可以使用精确本地 `NameRegex` Filter；自定义排序和倒序保持 Inline。

Mihomo 动态策略组只会从成功转换的节点中展开，因此不支持的代理协议不会被 `include-all` 重新加入。

如果上游策略组引用未知成员，`/status` 会返回 `GROUP_MEMBER_NOT_FOUND`。

如需对照测试，可以访问 `/status?token=...&compact=off`。

## 9. Rule Provider 失败

检查 Provider 类型：

- 纯文本：支持
- YAML payload：支持
- 二进制 `.mrs`：只有能推导出已知文本 sibling 时才支持

重点查看：

```text
MRS_SOURCE_UNMAPPED
RULE_PROVIDER_MISSING
```

## 10. 插件 policy 被意外修改

如果托管插件包含：

```text
policy=SomeGroup
```

但 `SomeGroup` 不存在于 YAML 生成的策略中，合并层会把它重映射到 FINAL，并返回 `LOON_NATIVE_POLICY_REMAPPED`。

应修复插件行或上游 YAML，不要长期依赖自动 fallback。

## 11. 电量消耗较高

使用：

```text
POWER_PROFILE=battery
```

然后通过 `/status` 检查实际 url-test interval。

battery 只改变测速频率，不改变策略组成员和分流逻辑。

如果功耗仍然较高，应继续检查 Loon Script、Rewrite、MitM 范围及第三方插件，这些不属于转换器的 url-test 调优范围。

## 12. Apple Watch / 系统服务异常

合并层包含范围较窄的 APNs / 本地发现兼容规则。

如果 Apple 服务仍然失败：

1. 先关闭可选插件复现；
2. 查看 Loon 请求日志；
3. 不要把整个 Apple 地址空间强制走一个统一策略；
4. 优先使用窄范围域名/网段例外。

## 13. WebRTC 仍暴露本地/公网地址

中性 Base 包含：

```text
disable-stun = true
udp-fallback-mode = REJECT
```

这些是偏隐私的默认值，但不是所有浏览器场景下的绝对隐私保证。

WebRTC 行为取决于浏览器、操作系统、网络和站点实现。请单独测试，不要仅凭 DNS 或 HTTP 代理结果判断 WebRTC 是否隔离。

## 14. 部署成功，但生产仍是旧版本

确认 CI/CD 命令真的把生产流量切到了新部署。

推荐：

```bash
npm run deploy
```

部署完成后，先重新检查 `/health` 和 `/status`，再继续排查 Loon。

## 15. 提交 Issue 时可安全提供的信息

可以提供：

- 项目版本
- warning code
- 协议类型
- 已脱敏的策略组结构
- 已脱敏的错误信息

不要提供：

- 真实订阅地址
- Token
- UUID / 密码
- 私有 Worker 域名
- 完整生成配置
- 私人插件地址
