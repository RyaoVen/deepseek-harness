# Agent Note: 主题分节中的主题色色板与动效级别

Status: implemented

[English](2026-08-13-theme-accent-palettes-and-motion.md) | 中文

## Problem

Web GUI 的主题只有一个轴：`light`／`dark`／`system`，唯一的主色是 DeepSeek 蓝品牌色阶，动效也没有任何控制手段。「多主题色与动效」于是意味着要么 fork token 样式表，要么接受单一色阶；而偏好无装饰动效的用户在产品里完全没有控制点。

## Decision

持久的 `ui-theme` 设置分节在 `preference` 旁新增两个字段，二者都有 schema 默认值，因此升级前已存储的分节照常工作：`accent`（七种色板——`deepseek`、`teal`、`violet`、`rose`、`amber`、`emerald`、`graphite`；`deepseek` 是随样式表发布的基准色阶，也是默认值）与 `motion`（`standard`／`reduced`，默认 `standard`）。ThemeRuntime 把二者作为快照字段持有，`setAccent`／`setMotion` 与 `setTheme` 一样经同一条 Host settings scope 写入；采纳早于这两个字段的分节时回退到默认值，而不是把快照字段清空。

投影仍归呈现器所有：ui-layout 的 ThemePresenter 从快照写出 `body[data-accent]` 与 `body[data-motion]`，与 `data-ds-dark-theme` 并排；宿主渲染的引导脚本也在渲染前设置同样的三个属性，因此非默认选择绝不会闪出基准色板。`accents.css` 按色板整体重定义 `--dsw-static-deepseek-*` 色阶（明暗两套块）——别名层本来就读取这些色阶，于是一个属性就能给整个产品换色。`motion.css` 在 `body[data-motion='reduced']` 与 `prefers-reduced-motion` 下压缩一切动画／过渡时长（压缩而非移除，动画生命周期事件照常触发），并导出共享的 `dsw-fade-rise-in` 关键帧；Modal 的对话框用它做入场。

外观行新增一行主题色色板（七个带标签的圆形色块，预览色为模块内字面量——色块必须显示自己的色板，与当前应用中的主题色无关，因此不能读取可被覆盖的 token）和两枚动效选择立方体，全部走既有的 store 镜像同步。

## Alternatives considered

- **把主题色做成注册的第三方主题**（`ThemeRuntime.register` + 别名 token 覆盖）——既有的扩展点。被否决：一种主色要重染整个品牌色阶，意味着每种色板要覆盖十几个静态色阶 token；注册表契约是进程内扩展语义，不是持久的产品设置；而且外观行终究还是要第二个选择器。
- **只在别名层覆盖主题色**——按色板覆盖 `--dsw-alias-brand-*` 等，而非静态色阶。被否决：引用品牌色的别名集合既宽又在增长（按钮、气泡、侧栏、业务状态色），别名层色板会静默漏掉新加入的别名消费方；静态色阶恰是每个别名都会读取的那一整套。
- **`reduced` 下直接移除动画**（`animation: none`）——常见捷径。被否决：移除会打断部分组件等待的动画生命周期事件；压缩时长既保留事件又几乎无动效。
- **会话行上的消息入场动画**——最显眼的动效候选。被否决（本次改动内）：会话行会虚拟化，纯 CSS 入场在每次滚动重挂载时都会重放；正确版本需要在渲染层按节点插入做门控，应属于另一次改动。

## Consequences

- 一对持久化属性即可给整个产品换色并门控全部装饰动效；二者经引导脚本在重载后存活，且与配色方案、`system` 解析彼此独立。
- token 层随包发布六套手工色阶；设计批准的色板改动只编辑 `accents.css`。
- `prefers-reduced-motion` 仍是独立下限：即便选择 `standard`，操作系统偏好也会将其压缩。
- 色块预览字面量是 token 样式表之外唯一拼写色板色值的地方；它们是色板定义，不是特性样式。
- 持久分节的 schema 变宽，settings seam 现在会在读取时物化 `accent`／`motion` 默认值；Host 支撑的持久化边界本身未变（[[2026-08-06-host-backed-web-preferences]]）。
