# 验证说明

[English](TEST_REPORT.md) | [简体中文](TEST_REPORT.zh-CN.md)

本文档说明公开版回归测试覆盖范围。内容刻意不包含任何真实订阅 URL、节点凭据、部署域名、账号标识或生产数据。

## 已覆盖的转换行为

- VLESS，包括 Reality 和 WebSocket 传输
- Trojan
- Hysteria2
- `dialer-proxy` → Loon Proxy Chain
- Clash / Mihomo Proxy Group → Loon Policy Group
- Rule Provider 转换与 Worker 托管远程规则
- 大型节点集合的精确名称 `NameRegex` 过滤器
- 稳定的 `/nodes` 远程订阅输出
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

- Base / Clash 区段归属规则
- Remote Filter 语法与顺序
- select 策略组顺序
- 节点去重
- battery / balanced / source interval 行为
- 托管插件注入
- 缓存 / 配置接线
- Apple 系统服务兼容保护

## 测试数据策略

仓库内提交的 fixture 只能使用保留/示例域名、文档 IP 网段、合成 UUID 和虚构凭据。禁止提交真实 Clash 订阅、代理凭据、Worker Token、私人插件地址或生成后的节点列表。
