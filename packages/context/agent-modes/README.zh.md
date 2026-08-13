# @deepseek-ai/dsh-agent-modes

[English](README.md) | 中文

持久化的会话级 agent 模式。宿主平面注册 `sessionModes` 服务（从会话日志折叠最近的 `mode/set` 事件；追加 `mode/set` 事件来切换）与 `sessionModesRemote` Typert Remote（按会话 id `get`/`set`——活动会话从存储读取，冷会话从持久化折叠，切换要求会话处于活动状态）。agent 平面（`./agent`，作为 preset 行挂载）注册一个活提示词段落，在每次组装时渲染会话当前模式及其指引，因此切换对下一次模型请求立即可见。

模式是建议性的：`mode/set` 事件对不认识它的读者标记为 `ignorable`，模式只通过提示词段落改变未来行为。内置模式为 `standard`、`creative`、`design` 与 `vibe`；spec 模式随其 issue 落地。

设计模式是强制的而非仅建议：当会话处于设计模式时，宿主平面在 `tools/pre-execute` 瀑布中拒绝文件读写工具（`read`、`write`、`edit`、`read_image`、`glob`、`grep`）与命令执行器（`bash`、`pwsh`）。研究工具（web 搜索、subagent、技能）保持可用，因为设计模式默认把资料搜集与论证委托给 subagent。

Vibe 模式由工作流引导：其指引把实现路由到固定 agent 集群工作流（[`dsh-tool-vibe-workflow`](../../workflow/tool-vibe-workflow/README.md)）——产品经理、并行的 UI 设计师与架构师、按模块的前端/后端工程师、测试工程师与问题升级。

## Model Experience

间接，经由它注册的每 agent 提示词段落——段落文本即模式指引，在组装时从会话的持久模式事件折叠而来，因此模式与其他提示词段落一样对模型可见。

#### KV Cache effect

无：段落文本每次组装仅数行，模式折叠是对会话日志尾部的扫描。

## Known Limitations and Deferred Work

- **切换要求会话处于活动状态** —— Remote 拒绝切换冷会话；浏览器切换的是它正在查看的活动会话，冷会话在恢复时保留其最后的持久模式。
- **设计模式之外指引是建议性的** —— 其他模式只改变提示词，不改变工具集；只有设计模式硬性禁用文件与命令工具。
- **提示词段落只随 `standard` preset 提供** —— 其他内置 preset（minimal、code、cordis）尚未挂载 agent 行。
