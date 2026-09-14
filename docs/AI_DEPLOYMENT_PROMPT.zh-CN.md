# AI 部署提示词

[English](AI_DEPLOYMENT_PROMPT.md) | [简体中文](AI_DEPLOYMENT_PROMPT.zh-CN.md)

这一页提供一份可以直接复制给 AI 助手或编程代理的 Clash2Loon 部署提示词。

适合 ChatGPT、Codex、Claude，或其他可以读取 GitHub 仓库，并可选连接 Cloudflare / 终端环境的 AI 工具。

## 怎么用

1. 打开你常用的 AI 助手。
2. 如果客户端支持 GitHub 连接，把这个仓库提供给 AI。
3. 如果客户端支持 Cloudflare 连接，建议提前授权 Cloudflare。
4. 把下面整段提示词复制给 AI。
5. 只有当 AI 进行到配置 Secret 的步骤时，再输入你的私人值。
6. 不要把 Secret 放进公开 Issue、Commit、截图或共享日志。

## 可直接复制的提示词

```text
我希望你帮我部署这个开源项目：
https://github.com/fxwl/clash2loon

目标是部署到我的 Cloudflare Workers，并最终帮助我完成 Loon 配置。

请作为部署工程师工作。开始前先阅读仓库，至少检查：
- README.md
- docs/DEPLOY.md
- docs/CONFIGURATION.md
- docs/LOON.md
- docs/TROUBLESHOOTING.md
- SECURITY.md
- .dev.vars.example
- wrangler.jsonc

部署目标：
1. 将当前 main 分支部署到 Cloudflare Workers。
2. 所有私人数据都不能写进 Git，也不能写进仓库文件。
3. 安全配置必需 Secrets：
   - CLASH_URL：我的完整 Clash / Mihomo YAML 订阅地址。
   - ACCESS_TOKEN：用于保护生成接口的高强度随机 Token。
4. 除非我明确要求，否则默认使用 POWER_PROFILE=battery。
5. 除非我明确要求，否则不要添加我的私人插件清单。
6. 不要自行猜测 CONTROL_PLANE_POLICY 或 CONTROL_PLANE_DOMAINS。只有当我提供了真实存在于 YAML 中的策略组，以及确实需要特殊分流的资源域名时才配置。
7. 节点、策略组、Rule Provider、规则以及 FINAL / MATCH 逻辑必须以上游 Clash / Mihomo YAML 为权威来源。

安全要求：
- 绝对不要把 CLASH_URL、ACCESS_TOKEN、代理凭据、私人插件 URL、私人域名、生成后的节点列表或 Loon 配置提交到 GitHub。
- 绝对不要把 Secret 写进 wrangler.jsonc、README、源码、测试、Issue、Commit Message 或截图。
- 我输入 Secret 后，不要在后续消息中再次完整复述它。
- 敏感值优先使用 Cloudflare Worker Secrets。
- 如果使用终端，优先使用 `wrangler secret put` 这类交互式命令，而不是把 Secret 直接写在命令参数里。
- `.dev.vars` 只能保存在本地，并保持未跟踪状态。
- 如果某个操作可能导致 Secret 暴露，先停止并告诉我更安全的做法。

执行模式：
- 如果你已经获得 GitHub 和 Cloudflare 的授权工具，请直接检查并执行部署。
- 如果你有带 Node.js/npm 的终端，可以克隆仓库并使用 Wrangler 部署。
- 如果你无法直接执行某一步，就给我准确的 Cloudflare Dashboard 或 CLI 操作步骤，等我反馈结果后继续。
- 没有实际验证之前，不要声称部署成功。

必须按以下流程执行：
A. 先检查仓库，并用几句话说明部署架构。
B. 检查前置条件：Cloudflare 账号访问权限；如果走 CLI，需要 Node.js >= 20、npm 和 Wrangler。
C. 部署前必须运行回归测试：
   `npm install`
   `npm run test:regression`
   如果测试失败，不得继续生产部署，先定位并解决测试失败。
D. 将 CLASH_URL 配置为 Cloudflare Secret。只有需要输入时再让我提供。
E. 生成或配置 ACCESS_TOKEN，并保存为 Cloudflare Secret。建议至少使用 32 字节随机值。设置后不要把最终 Token 输出到日志。
F. 检查 wrangler.jsonc 中的非敏感变量。默认保留 POWER_PROFILE=battery。
G. 使用以下命令部署生产流量：
   `npm run deploy`
   不要使用只上传版本、但不会切换生产流量的命令。
H. 验证无需鉴权的接口：
   `https://<worker-host>/health`
   必须返回 HTTP 200，并且 `ok: true`。
I. 验证带鉴权的状态接口：
   `https://<worker-host>/status?token=<ACCESS_TOKEN>`
   检查 ok、转换统计、warnings、finalPolicy、转换节点数量、合并配置统计等信息。
J. 如果 `/status` 存在 warnings，逐条说明哪些属于正常兼容性提示，哪些必须处理。不要静默忽略转换错误。
K. 验证 `/nodes` 和 `/loon` 能够成功返回。不要把完整内容粘贴到公开日志，因为里面可能包含私人代理信息。
L. 最终给我 Loon 远程配置地址，格式为：
   `https://<worker-host>/loon?token=<ACCESS_TOKEN>`
   这个 URL 包含访问 Token，应当视为敏感信息。
M. 告诉我如何把这个地址加入 Loon，以及后续如何更新配置。
N. 如果我绑定了自定义域名，先验证这个自定义域名下的 `/health` 和 `/status`，验证成功后再推荐我在 Loon 中使用它。
O. 最后给我一份简短部署检查清单，只包含状态和接口名称，不要重复 Secret。

故障排查原则：
- 如果 `/health` 失败，优先检查 Worker 部署、自定义域绑定、DNS、TLS 和生产流量路由，不要先改 Clash YAML。
- 如果 `/health` 正常但 `/status` 失败，检查 ACCESS_TOKEN、CLASH_URL、上游 HTTP 返回、YAML 有效性和转换异常。
- 如果 `/nodes` 正常但 `/loon` 失败，检查配置合并、策略引用、Remote Filter 语法、可选 Loon Base 和插件配置。
- 如果 Safari 可以访问 `/loon`，但 Loon 开启时无法更新，检查自路由 / TUN 行为，并按照仓库故障排查文档处理。
- 如果某个插件或规则资源只有在 Loon 开启时失败，只有在已知真实 YAML 策略组和目标资源域名时，才使用 CONTROL_PLANE_POLICY 和 CONTROL_PLANE_DOMAINS。
- 不要为了修复单一兼容问题，就强制全部 Apple、GitHub、CDN 或所有海外流量走同一个策略。

开始前先告诉我你实际能使用哪一种执行模式：
1. 已连接 GitHub + Cloudflare 工具；
2. 有终端 + Wrangler；
3. 只能由你指导我手工操作 Cloudflare Dashboard。

然后从“检查仓库 + 检查前置条件”开始。
```

## AI 最终应当交付什么

一次完整的 AI 辅助部署最终应确认：

- 回归测试通过；
- Worker 已切换到生产版本；
- `CLASH_URL` 已安全保存为 Secret；
- `ACCESS_TOKEN` 已安全保存为 Secret；
- `/health` 已验证；
- `/status` 已验证；
- `/nodes` 已验证但没有泄露完整内容；
- `/loon` 已验证但没有泄露完整内容；
- 已给用户私人 Loon 远程配置 URL；
- 已解释所有重要 warnings。

## 推荐的后续提示词

部署完成后，可以继续把下面这段发给 AI：

```text
请帮我检查 Clash2Loon 的 /status 输出。逐条解释所有 warning，区分哪些只是正常的兼容性提示，哪些必须修改配置。不要让我粘贴节点凭据，也不要要求我提供完整 /nodes 内容。
```
