# Agent Note：可持久化会话模式与即时切换

Status: implemented

[English](2026-08-14-durable-session-modes.md) | 中文

## 问题

会话的工作风格在组合层固定：plan mode 是唯一类似模式的状态，且它是无持久会话值、无切换界面、无法在对话中途改变 agent 工作方式的每 agent 插件。所要求的「模式切换」需要一种持久、可切换、按会话生效的模式，并能影响下一次模型请求。

## 决策

两个新包实现可持久化会话模式。

`@deepseek-ai/dsh-agent-modes` 拥有模式词汇表（`standard`/`creative`，事件类型设计为后续模式可扩展联合）、持久按会话状态与两个平面。宿主平面注册 `sessionModes` 服务——`get(session)` 从会话自身的持久日志折叠最近的 `mode/set` 事件（重放稳定，默认 `standard`），`set(session, mode)` 追加 `mode/set` 事件——以及 `sessionModesRemote` Typert Remote（按会话 id `get`/`set`）：活动会话从会话存储读取，冷会话从持久化折叠，重启不会丢失模式，切换要求会话处于活动状态。agent 平面（`./agent`，作为 preset 行挂载）注册一个活提示词段落，在每次组装时折叠 agent 自身的会话并渲染当前模式与指引，因此切换对下一次模型请求立即可见。`mode/set` 事件标记为 `ignorable`，不认识的读者可安全跳过。

`@deepseek-ai/dsh-client-ui-mode-switcher` 是界面：一个 `/mode` popupSelect 命令，列出所有已知模式并把当前会话模式标记为活动，经 `sessionModesRemote/get` 读取、经 `sessionModesRemote/set` 切换。

接线沿用既有接缝：api-remotes 客户端组装挂载新 Remote，Web 组合新增一行宿主行与一行客户端行，`standard` preset 挂载 agent 平面行，两个类型检查聚合引用新工程。

## 备选方案

- **模式放会话头** —— 创建时写一次的头字段。否决：头不可变且在创建时写入，会话中途切换需要新头；日志事件把切换历史与重放语义和其余日志放在一起。
- **模式作为设置命名空间** —— 像主题那样的全局设置值。否决：设置是全局且进程存活的，而模式按会话生效且必须随会话自己的日志跨重启存活；日志事件才是会话作用域的持久居所。
- **在循环中强制模式** —— agent loop 直接读取模式并门控工具。本 issue 否决：loop 是核心接缝且有架构文档所有权；先交付建议性提示词级模式，行为强制（设计模式的禁令）随设计模式 issue 落地。

## 影响

- 每个会话现在都有持久、可切换、跨重启存活并影响下一次请求的模式。
- 折叠是纯 latest-wins 扫描；事件对旧读者可忽略。
- `standard` preset 增加一个提示词段落；其他 preset 可挂载 agent 行选择加入。
- Web 包新增一个宿主 Remote 与一个命令界面；两个包均有单元测试覆盖（折叠、服务、Remote 活动/冷路径、命令注册与选择）。
