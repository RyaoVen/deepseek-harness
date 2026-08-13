# Agent Note：桌面挂饰窗与 UI 美化

Status: implemented

[English](2026-08-15-desktop-decoration.md) | 中文

## Problem

桌面壳（issue #3）只是 Web GUI 之上的普通窗口：没有环境存在感，窗口在后台时看不到会话状态，也没有设置席位。要求的挂饰是透明置顶的吉祥物小窗，镜像会话状态，外加一轮基于 token 的 UI 打磨。

## Decision

壳层新增挂饰窗，Web 设置页新增其开关；打磨沿用既有主题 token。

**挂饰窗**（`apps/desktop`）：150×150 的透明、无边框、置顶、跳过任务栏 `BrowserWindow` 加载本地纯页面（`decor.html`/`decor.css`/`decor.js`——无打包器）。吉祥物是 CSS 球体，由 `body[data-status]` 驱动三态：空闲（轻缓浮动）、思考中（轨道环旋转 + 眯眼）、完成（对勾徽章弹出）。页面打开 GUI 所用的同一 `/api/events.mux` WebSocket 下行，折叠 `step/start` → 思考中、`step/end`/`turn/end` → 完成（短暂后回到空闲）——挂饰与会话状态按构造联动，零客户端接线、主窗口无需桥。球体本身非拖动区（点击聚焦主窗口；右键菜单提供「隐藏挂饰」「退出」）。启用状态持久化在 `userData/window-state.json`。

**设置开关**（`@deepseek-ai/dsh-client-ui-desktop-decoration`）：通过 Appearance 行所用的同一 `settings.general.item` 插槽注册的 General 区行。它检测 `window.desktopBridge`（主窗口新增的 preload——经 contextBridge 暴露 `getDecorEnabled`/`setDecorEnabled`），普通浏览器中渲染为空；用户切换优先于异步初始读取。

**UI 打磨**（token 驱动）：`design-platform.css`（双色板）新增三个主题 token 并注册供检视——`--dsw-alias-surface-glass`、`--dsw-alias-border-glass`、`--dsw-alias-gradient-brand`。用户消息气泡获得渐变发丝边（填充走 padding box、品牌渐变走 border box）与短入场动画；侧边栏列与详情面板成为玻璃拟态表面（半透明填充 + `backdrop-filter: blur`）。动效系统的 reduced-motion 规则自动压缩新动画。

## Alternatives considered

- **客户端状态桥** —— GUI 经 preload 向壳层上报忙碌状态。拒绝：需要接入会话状态的新客户端插件与第二条 IPC 路径；mux 下行本身就是会话状态，挂饰页直接消费它。
- **挂饰做 Web 路由** —— 挂饰窗以特殊 hash 加载 GUI。拒绝：GUI 自带背景、脚本与连接抖动；本地页只是其表面的一小部分。
- **开关用宿主设置** —— 从 GUI 切换 `dsh-settings` 命名空间。拒绝：开关是壳窗口关切而非 harness 设置；壳自身持久化状态加桥只多一对 IPC。

## Consequences

- 挂饰始终镜像会话（与 GUI 同一事件流），无需 GUI 代码，且只能在壳内从设置页开关。
- 打磨主题安全：新 token 双色板齐全，动画感知动效偏好，UI 样式中没有硬编码颜色。
- 壳的发布文件增加页面与 preload；约束门禁的桌面 files 政策随之更新。
