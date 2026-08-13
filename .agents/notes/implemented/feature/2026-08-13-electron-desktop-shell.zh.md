# Agent Note: Web GUI 的 Electron 桌面壳

Status: implemented

[English](2026-08-13-electron-desktop-shell.md) | 中文

## Problem

Web GUI 活在浏览器标签页里：使用它意味着运行 `dsh --profile web` 并手动打开打印出的 URL。桌面产品需要双击即开：GUI 出现在原生窗口里，服务生命周期由应用自己管理。

## Decision

`apps/desktop` 是新的 workspace 应用（纯 Electron main，ESM，无构建步骤），拥有完整生命周期：以 `--port 0` 拉起 workspace 的 `dsh` CLI，解析打印出的 `dsh web: http://…` URL 行，轮询 URL 直到 HTTP 200，然后在 `BrowserWindow` 中加载。壳层不添加任何页面代码，也不扩展任何服务端表面——GUI、模型、凭据与设置完全是 Web GUI 自身的，因此壳层与 `dsh` 升级解耦。单实例锁、托盘（打开主窗口 / 在浏览器中打开 / 退出）、`userData` 中的窗口大小持久化、退出时的进程树回收（Windows 用 `taskkill /T /F`，POSIX 用进程组）构成其余应用行为。`electron-builder` 面向 Windows NSIS 安装包；打包后的 CLI 经 `extraResources` 期望位于 `resources/dsh-cli`，完整依赖闭包的部署留待后续。

## Alternatives considered

- **Tauri**——二进制更小、内存更低，但 harness 是 Node 进程：Tauri 壳仍然要拉起同一个 `dsh` 子进程，此外还要背负 Rust 工具链与 sidecar 打包管线。Electron 复用 workspace 的 Node 工具链，`electron-builder` 一份配置即可完成 Windows 打包。
- **仅启动浏览器**（现状，`dsh web` 打印 URL）——没有应用身份、没有托盘、没有生命周期归属；正是本改动要替换的。
- **进程内嵌服务**——在 Electron main 进程里导入 web 组合。被否决：harness 自身的组合启动正是 `dsh web` 已经在做的事，独立子进程保留崩溃与隔离边界，也让壳层可以独立于服务存活或重启服务。

## Consequences

- 原生窗口取代手动开浏览器；退出应用会可靠地停掉服务（不会留下孤儿 `dsh web` 进程）。
- 子进程边界意味着 GUI 崩溃或重启不会拖垮壳层，壳层可以重新拉起它。
- 独立发行版仍需要把 CLI 依赖闭包部署到 `resources/dsh-cli` 旁边；开发模式（workspace 安装）是当前完全受支持的路径。
- 壳层以 Windows 优先（NSIS 目标）；macOS/Linux 目标留待后续。
