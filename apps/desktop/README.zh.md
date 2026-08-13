# @deepseek-ai/dsh-desktop

[English](README.md) | 中文

DeepSeek Harness 的桌面壳：它把 `dsh --profile web` 作为子进程拉起，等待服务端打印 URL 行并返回 HTTP 200 后，在原生 Electron 窗口中展示 Web GUI——不再需要浏览器标签页。

## 运行

在仓库根目录（需要 workspace 中的 `dsh` CLI 已安装）：

```sh
pnpm --filter @deepseek-ai/dsh-desktop start
```

壳层从 workspace（`@deepseek-ai/dsh`）解析 `dsh` CLI，以 `--port 0`（由操作系统分配空闲端口）拉起，解析打印出的 `dsh web: http://…` 行，轮询该 URL 直到服务应答，然后在窗口中加载。

## 行为

- **单实例**——再次启动会聚焦既有窗口，而不是再起一个服务。
- **窗口状态**——窗口大小持久化到 `userData/window-state.json`，下次启动恢复。
- **托盘**——托盘图标提供「打开主窗口」「在浏览器中打开」（服务就绪时）与「退出」。
- **桌面挂饰**——启用后（Web 设置 General 区的开关，仅在壳内可见），一个透明的 150×150 置顶小窗显示吉祥物球体，通过折叠 GUI 所用的同一 `/api/events.mux` 下行镜像会话状态（空闲/思考中/完成）；球体可拖动，点击回到主窗口，右键提供「隐藏挂饰」「退出」。开关状态持久化在 `userData/window-state.json`。
- **干净退出**——退出时回收子 `dsh web` 进程树（Windows 用 `taskkill /T /F`，POSIX 用进程组）。
- **凭据姿态**——壳层对服务端表面不做任何添加：GUI、模型、凭据与设置完全是 Web GUI 自身的。

## 打包

```sh
pnpm --filter @deepseek-ai/dsh-desktop build
```

`electron-builder` 产出 Windows NSIS 安装包。打包应用期望 CLI 位于 `resources/dsh-cli`（已配置从 workspace `@deepseek-ai/dsh` 包复制 `extraResources`）；完整发行版还需一并部署该包的依赖闭包。

## Known Limitations and Deferred Work

- **打包后的 CLI 闭包**——`extraResources` 只复制 `@deepseek-ai/dsh` 包目录；其传递依赖尚未随包部署，因此打包构建需要 CLI 的依赖能从解压出的 resources 中解析（开发模式使用 workspace 安装，是当前完全受支持的路径）。
- **Windows 安装包签名**——NSIS 目标未签名；正式分发需要代码签名证书。
- **macOS/Linux 打包**——只配置了 Windows 目标；可在 electron-builder targets 中补充其他平台。
