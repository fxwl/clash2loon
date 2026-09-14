# 贡献指南

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

感谢你考虑为 Clash2Loon 贡献代码或文档。

## 开发环境

```bash
git clone https://github.com/fxwl/clash2loon.git
cd clash2loon
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

提交到仓库的测试数据只能使用合成数据。

## 提交修改前

请先运行：

```bash
npm run test:regression
```

如果修改涉及协议转换，也请使用不包含真实凭据的脱敏 fixture 进行测试。

## Pull Request 应说明

一个有效的 PR 应说明：

1. 修改了哪一种 Loon 或 Mihomo 行为。
2. 解决了什么兼容性问题。
3. 哪些参数被有意丢弃、降级或近似处理。
4. 新增或更新了哪些测试。
5. 是否可能影响已有生成配置。

## 隐私规则

不要提交：

- 真实订阅 URL
- 真实节点凭据
- 私人 Worker 域名
- Access Token
- 私人插件 Token
- 包含 Secrets 的截图
- 生产环境生成配置

请替换为：

- `example.com`
- RFC 5737 文档 IPv4 网段（如 `192.0.2.0/24`）
- 合成 UUID
- 虚构密码
- 通用策略名

## 代码风格

- 对未文档化的 Loon 行为，优先采用保守转换，不要猜测。
- 输入字段无法安全映射时，应返回 warning。
- 保持 Clash YAML 对分流和策略成员关系的权威性。
- 不要静默重写用户业务分流策略。
- 尽可能保持输出稳定。

## 增加协议支持

新增协议或传输方式时：

1. 增加转换函数。
2. 增加严格的合成 fixture。
3. 文档化不支持字段。
4. 验证 `/nodes` 输出能被 Loon 接受。
5. 修改生产行为前先补回归测试。

## 第三方集成

不要把第三方插件清单、个人规则集、订阅服务或私人基础设施地址作为默认值加入项目。可选集成应通过环境变量或用户自有 Loon Base 配置。
