# @deepseek-ai/dsh-client-ui-mode-switcher

[English](README.md) | 中文

会话模式切换器，浏览器半端：一个 `/mode` popupSelect 命令，列出所有已知模式并把当前会话的模式标记为活动，经 `sessionModesRemote/get` 读取、经 `sessionModesRemote/set` 切换。持久模式状态与每 agent 提示词段落属于 `dsh-agent-modes`；本包只是界面。

## Model Experience

无，此浏览器端命令界面只渲染模式列表，不注册任何提示词、工具、消息或提供方请求。

#### KV Cache effect

无；本包从不组装模型输入。

## Known Limitations and Deferred Work

- **仅命令界面** —— 作曲栏尚无内联模式指示器；当前模式在弹出层的活动行与 agent 的提示词段落中可见。
- **无按模式子菜单** —— 带选项的 spec 模式将随其 issue 扩展弹出层行。
