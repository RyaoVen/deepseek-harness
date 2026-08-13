# @deepseek-ai/dsh-agent-modes

[English](README.md) | 中文

持久化的会话级 agent 模式。宿主平面注册 `sessionModes` 服务（从会话日志折叠最近的 `mode/set` 事件；追加 `mode/set` 事件来切换）与 `sessionModesRemote` Typert Remote（按会话 id `get`/`set`——活动会话从存储读取，冷会话从持久化折叠，切换要求会话处于活动状态）。agent 平面（`./agent`，作为 preset 行挂载）注册一个活提示词段落，在每次组装时渲染会话当前模式及其指引，因此切换对下一次模型请求立即可见。

模式是建议性的：`mode/set` 事件对不认识它的读者标记为 `ignorable`，模式只通过提示词段落改变未来行为。内置模式为 `standard` 与 `creative`；设计、vibe 与 spec 模式随各自 issue 落地。

## Model Experience

间接，经由它注册的每 agent 提示词段落——段落文本即模式指引，在组装时从会话的持久模式事件折叠而来，因此模式与其他提示词段落一样对模型可见。

#### KV Cache effect

无：段落文本每次组装仅数行，模式折叠是对会话日志尾部的扫描。

## Known Limitations and Deferred Work

- **切换要求会话处于活动状态** —— Remote 拒绝切换冷会话；浏览器切换的是它正在查看的活动会话，冷会话在恢复时保留其最后的持久模式。
- **指引是建议性的** —— 模式只改变提示词，不改变工具集或权限；行为强制（设计模式的读写/命令禁令）属于设计模式 issue。
- **提示词段落只随 `standard` preset 提供** —— 其他内置 preset（minimal、code、cordis）尚未挂载 agent 行。
