# @deepseek-ai/dsh-client-ui-desktop-decoration

[English](README.md) | 中文

桌面挂饰开关，浏览器半端：设置 General 区的一行，用于显示或隐藏 Electron 挂饰窗（置顶吉祥物）。该行只在页面运行于桌面壳内时出现——它检测 `window.desktopBridge`，在普通浏览器中自我隐藏。桥是唯一的壳触点：开关读取与写入壳持久化的启用状态；挂饰窗的会话状态动画由它自己的 mux 下行馈送，不经过本包。

## Model Experience

无，此浏览器端设置行只渲染一个开关，不注册任何提示词、工具、消息或提供方请求。

#### KV Cache effect

无；本包从不组装模型输入。

## Known Limitations and Deferred Work

- **仅桌面表面** —— Electron 壳之外该行不可见；浏览器部署没有可切换的挂饰。
- **单一全局开关** —— 挂饰窗及其状态镜像暂无按会话或按窗口的选项。
