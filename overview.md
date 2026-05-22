# Obsidian Export PDF - Save Dialog Fix (2026-05-22)

## 修改内容

将保存位置选择的 `webkitdirectory` 目录拾取器替换为 **Electron 原生 Save 对话框**。

## 问题

1. `webkitdirectory` 在 Electron 中显示"上传"按钮，而不是"保存/另存为"
2. `files[0].path` 在 Obsidian 的 contextIsolation 环境下为 undefined，导致选择文件夹后路径不回填

## 解决方案

**三层回退策略：**

1. **首选：Electron `dialog.showSaveDialog()`** — 原生"另存为"体验，同时支持目录导航和文件名编辑
   - 依次尝试 `@electron/remote` → `electron.remote` → `electron.dialog`
   - 跨平台（macOS/Windows/Linux）
   
2. **回退：`webkitdirectory`** — 当 Electron dialog API 不可用时
   - 检测 `files[0].path` 是否可用
   - 不可用时给出明确提示，引导用户手动输入路径

3. **手动输入** — textarea 始终可编辑，用户可直接修改完整路径

## 测试方式

在 Obsidian 中重新加载插件 → 右键 .md 文件 → Export to PDF → 点击"选择"按钮
