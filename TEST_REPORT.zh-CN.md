# 验证说明

[English](TEST_REPORT.md) | [简体中文](TEST_REPORT.zh-CN.md)

本文档说明公开版回归测试覆盖范围。内容刻意不包含任何真实订阅 URL、节点凭据、部署域名、账号标识或生产数据。

## 已覆盖的转换行为

- VLESS，包括 Reality 和 WebSocket 传输
- Trojan
- Hysteria2
- SOCKS5（`socks` / `socks5`），包括认证与 TLS 节点
- `dialer-proxy` → Loon Proxy Chain，包括 SOCKS5 落地节点
- Clash / Mihomo Proxy Group → Loon Policy Group
- Mihomo 动态策略组：`include-all` / `include-all-proxies`、`filter`、`exclude-filter`
- 通过 `C2L_Nodes = /nodes` 加载的 `[Remote Proxy]` 链接节点
- 使用限定 `C2L_Nodes` 来源的精确 `NameRegex` Remote Filter 承载链接节点策略成员
- 自定义/倒序策略组的顺序安全回退
- `compact=off` 使用逐节点精确 Remote Filter 的兼容模式
- 策略组压缩与单行字节数诊断
- 稳定的 `/nodes` 输出，并作为链接节点订阅源
- Rule Provider 转换与 Worker 托管远程规则
- 精确节点定义去重
- `url-test` 策略组可配置功耗档位
- Loon 原生区段保留与失效策略引用重映射
- 来自 `MANAGED_PLUGINS_JSON` 的可选托管插件
- Worker 配置刷新所需的可选自域名绕过
- 可选控制面资源分流

## 回归测试

运行：

```bash
npm install
npm run test:regression
```

回归套件检查：

- Base / Clash 区段归属规则；
- 小型策略组同样通过 Remote Filter 引用链接节点；
- 192 节点混合压缩与 Filter 复用；
- 自定义/倒序策略组使用逐节点精确 Remote Filter 保持顺序；
- `compact=off` 每个链接节点一个精确 Remote Filter 的回退；
- Mihomo 动态策略组展开及不支持节点排除；
- 节点去重；
- SOCKS5 转换与 SOCKS5 `dialer-proxy` 中转链生成；
- battery / balanced / source interval 行为；
- 托管插件注入；
- 缓存 / 配置接线；
- Apple 系统服务兼容保护。

## 测试数据策略

仓库内提交的 fixture 只能使用保留/示例域名、文档 IP 网段、合成 UUID 和虚构凭据。禁止提交真实 Clash 订阅、代理凭据、Worker Token、私人插件地址或生成后的节点列表。
