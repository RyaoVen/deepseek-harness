# @deepseek-ai/dsh-tool-vibe-workflow

[English](README.md) | 中文

模型面向的 **`vibe` 工具**：在 [`ctx.workflowEngine`](../workflow/README.md) 上运行固定 agent 集群工作流——vibe 模式的默认流程。一次调用跑完整个集群：产品经理澄清请求并整理需求档案，UI 设计师与架构师并行开工，前端与后端工程师按架构师模块分 part 实现并逐 part 写单元测试（架构师的模块按层各派生一个工程师实例，因此多实例并发运行），测试工程师全盘 review 交付物。问题逐级反上报：架构师分派修复、工程师应用、测试工程师验证。canned 脚本是包内常量；本包拥有模型面向 schema 与运行生命周期，而解析、执行、上限与取消都在引擎接缝之后。

## What the model sees

两个参数：`request`（必填——集群要处理的用户请求或实现目标）与 `answers`（可选——回答上一次运行 `openQuestions` 的用户决策，让 needs-input 运行可续跑而非重来）。插件还注册一个 `tool:<toolName>` 系统提示词段落承载使用策略——在 vibe 模式或用户要求固定 agent 集群工作流时使用 `vibe` 工具；运行返回 "needs-input" 时询问用户并带答案重跑——遵循工具指引随工具插件分发、绝不进部署人格的约定。

运行的规范值是集群摘要：`stage`（`done`、`needs-input` 或 `failed`）、需求档案、样式规范、架构、逐模块工程师报告、测试报告，以及测试工程师发现问题时的升级记录。

## Lifecycle

收集是同步的（同 [`dsh-tool-workflow`](../tool-workflow/README.md)）：`execute` 启动运行并在 `try/finally` 中等待 `run.result`，任何路径都会 dispose 运行，因此脚本与子 agent 在所有路径上都达到静默。`exec.signal` 桥接到 `run.cancel()`（包括启动前已中止的情形）。非 `completed` 停止原因映射为报告原因的 `isError` 结果——绝不把部分输出当作成功。完成返回规范 `{ runId, agentsStarted, result }`；Native 渲染保留请求、agent 数与 JSON 值，仅按 `maxResultChars` 截断该投影。

## Render intent

预先决定（见 [render-intent Agent Note](../../../.agents/notes/implemented/architecture/2026-07-02-tool-render-intent-union.md)）：标题为 `vibe` 的 `generic` 卡片，请求文本作为 `rawInput`（呈现是参数的纯函数）。结果保持 generic 卡片。

## Config

| Key | Default | Meaning |
|---|---|---|
| `toolName` | `vibe` | 注册的模型面向工具名。 |
| `maxResultChars` | `50000` | 渲染结果上限；更长的 JSON 附截断提示。 |

## Model Experience

### System prompt

#### What the model sees

本插件注册作用域内的每个父请求都会收到下列 vibe 指引。作用域工具限制可以隐藏 schema，但不会移除这条独立注册的指引。

##### Vibe guidance

```markdown
Use the <toolName> tool when the session is in vibe mode or the user asks for the fixed agent-cluster workflow. It runs the whole cluster in one call; when it returns "needs-input", ask the user the open questions and re-run with the answers.
```

#### Token effect

插件激活期间每个请求的小额固定指引开销。

#### KV Cache effect

插件作用域与指引文本不变时前缀稳定。激活或销毁可能使本提示词段落失去复用。

### Tool schema

#### What the model sees

生成的默认 [`vibe` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-vibe-workflow) 携带 `request` 与 `answers` 参数；`toolName` 可重命名定义，模型提交请求（以及上次运行的可选答案）。

#### Token effect

工具可见的每个请求的小额固定 schema 开销。

#### KV Cache effect

`toolName`、定义与可见性不变时前缀稳定。重命名、插件生命周期或作用域限制可能使本 schema 失去复用。

### Tool-call history and result

#### What the model sees

请求与答案保留在助手工具调用中。成功精确为 `vibe cluster completed (<count> agent<optional-s>) for: <request>.`、换行、`Return value:`、换行，以及美化打印的数据相关 JSON；超限追加一行 `… [truncated: <omitted> more characters]`。失败精确为 `Error: vibe run was cancelled`（可选后缀 ` (<error>)`）、`Error: vibe run failed: <error-or-unknown error>`，或防御性 `Error: vibe run ended abnormally (<reason>)`；无所属 agent 的调用变为 `Error: vibe tool requires a calling agent (exec.agent was undefined)`。中间子消息被省略。

#### Token effect

调用 token 可能较大并保留到压缩。结果渲染受 `maxResultChars` 限制；子模型 token 与父上下文分离。

#### KV Cache effect

只追加；新可见内容跟在可复用请求前缀之后，不使既有 KV-cache 条目失效。

## Known Limitations and Deferred Work

- **父回合阻塞到整个集群静默** —— 没有后台启动/轮询 API，取消把部分输出当作错误丢弃。
- **单轮升级** —— 集群修复并复验一次；第二轮问题留在验证报告中，由调用 agent 处理。
- **子 agent 未必能触达用户** —— 集群把用户决策路由到调用 agent：开放问题以 `needs-input` 浮出，调用者带答案重跑；拥有 `ask_user` 工具的子 agent 可直接询问。
- **引擎与提供方上限适用** —— 模块扇出受 workflow 引擎并发与总 agent 上限约束。
