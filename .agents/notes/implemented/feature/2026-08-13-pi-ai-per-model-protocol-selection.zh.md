# Agent Note: llm-pi-ai 的按模型协议选择

Status: implemented

[English](2026-08-13-pi-ai-per-model-protocol-selection.md) | 中文

## Problem

提供方路由的 `api` 原本是路由级事实：该路由上的每个模型都只说一种协议。多协议网关——OpenCode、GitHub Copilot 以及手工声明的聚合网关——在同一个端点、同一把密钥背后同时服务 `openai-completions`、`openai-responses` 与 `anthropic-messages` 的模型，使用这类网关的部署想要的是**一条**路由，其下每个模型各自说自己的协议。当时的配置只能整条路由改指，于是被迫一种协议开一条路由，端点、密钥与容量也要逐条重述。

## Decision

模型条目——`models` 列表项与 `modelOverrides` 的值——可以点名 `api`，解析顺序为条目 `api` → 路由 `api` → 已安装 catalog 条目 → 该路由已发布模型一致同意的协议。只有两种拼写会被接受：`supportedProtocols()` 中的某个协议，或该 catalog 模型自己的 api，后者只是重述默认值、什么都不改指；其余拼写都会使解析失败，并点名路由与模型。某条路由上只要有一个模型的 api 偏离了路由级答案，该路由就是**改指（repointed）**的，此时解析要求它上面的每个模型都说 `supportedProtocols()` 里的协议——一个只有 catalog 才能服务的同门模型（例如 `bedrock-converse-stream`）会使解析失败，而不是被一个无法与改指并存的 provider 服务。提供方构造为这类路由新增第三种形态：一个派发 provider，其 `stream`/`streamSimple` 按 `model.api` 经同一张协议表逐请求解析协议实现；协议表迁入 `protocols.ts`，让解析与构造共享它而不形成模块环。

## Alternatives considered

- **只保留路由级协议**——一种协议一条路由，逐条重述端点与凭据。被否决：这正是本特性要移除的配置税，而设置界面本就逐条编辑模型条目。
- **带 catalog 回退的派发**——改指路由上协议表构造不了的模型，其请求委托回被复用的 catalog provider 的 stream。被否决：catalog 与协议表混搭的路由是凭空设想而非实际所需；回退的语义取决于具体是哪个 catalog provider 实现了哪个 api；而要求改指路由完全由协议表服务，能在解析处失败——模型被点名——而不是在请求时。
- **在 schema 层按 `supportedProtocols()` 校验模型 api**——在 settings 边界拒绝错误拼写。被否决：no-op 拼写——该 catalog 模型自己的 api，可能是 Bedrock 这类仅 catalog 协议——只有挨着 catalog 条目才可知，因此 schema 保持只校验形状，精确校验放在解析处，与 `reasoningEfforts` 已有的拆分一致。

## Consequences

- 一条网关路由可以混搭 OpenAI、Anthropic 与 Responses 模型，逐个在设置里选择。
- 改指路由失去 catalog provider 复用；协议表成为其上每个模型的天花板。Bedrock 一类的路由改指一个模型时，也必须同时改指或重述其异质同门模型，解析会点名每一个留下的。
- `supportedProtocols()` 的公开语义不变，只是归属迁到 `protocols.ts`；包根入口的再导出不变。
- 按模型的 `compat` 开关继续只作用于解析后 api 为 `openai-completions` 的模型，与[声明式提供方 catalog 决策](../architecture/2026-08-03-pi-ai-declared-provider-catalog.md)一致；该决策现在把派发 provider 记为第三种构造。
