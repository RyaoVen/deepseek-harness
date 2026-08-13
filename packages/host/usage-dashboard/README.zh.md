# @deepseek-ai/dsh-host-usage-dashboard

[English](README.md) | 中文

从每条持久会话日志折叠得到的模型用量只读宿主投影。`UsageDashboardGateway` 注册 `usageDashboard` 服务，并发布一个生成的直接 Remote：`usageDashboard/summarize`。每次调用枚举已物化的会话，折叠所有携带适配器上报用量的 `assistant/message` 事件（跳过非模型来源与无用量事件），并返回按模型、按 UTC 日、按 UTC 时段分桶的汇总与总计。

会话按持久化修订缓存：第二次调用只重读存储日志发生变化的会话，消失的会话会从缓存中逐出。加载失败的会话会被跳过并记录，因此单条损坏日志不会拖垮仪表盘。折叠本身是对持久日志的纯求和——重放与压缩都不会改变它。

该服务仅面向 Remote，并刻意不声明同进程的 Cordis `Context` 合并。客户端包通过显式的 [`api-remotes`](../../api/remotes/README.md) 组装消费它，而不是导入宿主实现。

## Model Experience

无，此仅宿主的用量投影不注册任何提示词、工具、消息或提供方请求。

#### KV Cache effect

无；本包从不组装模型输入。

## Known Limitations and Deferred Work

- **仅 UTC 分桶** —— 日与时段按 UTC 分桶，远离 UTC 的部署会看到日历偏移；本地时分桶属于客户端，暂缓实现。
- **调用数以 assistant 消息为单位，而非提供方请求** —— 以适配器上报的 `assistant/message` 为单元，因此被提供方重试或拆分的请求仍按每条组装消息计一次。
- **缓存仅限进程内** —— 按修订的折叠缓存存活于运行中的宿主；重启后首次读取仪表盘会重新折叠所有会话。
