# Export PDF Compress

[中文](#chinese) | [English](#english)

---

## 中文

一款 Obsidian 插件，将 Markdown 笔记导出为 PDF，**支持图片自动压缩**。

与其他依赖浏览器渲染的 PDF 导出插件不同，本插件使用 **Python（reportlab + Pillow）** 作为渲染引擎，支持精确控制图片质量、可靠的中文字体渲染，生成的 PDF 文件体积显著更小。

### 功能特点

- **图片压缩** — JPEG 质量可调（默认 60%），最大宽度可控（默认 900px）
- **SVG 图片支持** — 嵌入式 SVG 通过 resvg 渲染为高清位图（2x 缩放）
- **中文字体支持** — macOS 系统字体（苹方/黑体/宋体）自动注册
- **Obsidian 维基链接** — `![[图片名.png]]` / `![[图片名.svg]]` 自动解析
- **标准 Markdown 图片** — `![alt](image.png)` 支持
- **Excalidraw 阻断守卫** — 检测到 `.excalidraw` 引用时阻止导出，提示用户先转换为 PNG/SVG
- **Vault 根目录图片搜索** — 自动搜索 vault 根目录及附件子目录
- **表格、代码块、列表** — 完整 Markdown 解析
- **YAML Frontmatter** — 自动去除

### 环境要求

- **Python 3**，需安装 `reportlab`、`Pillow` 和 `resvg-py`：

```bash
pip3 install reportlab Pillow resvg-py
```

- **仅支持 macOS**（使用系统 CJK 字体；Linux/Windows 需调整字体路径）

### 测试环境

| 项目 | 详情 |
|------|------|
| **操作系统** | macOS 15 (Sequoia) · Apple Silicon (M4) |
| **Obsidian** | 1.8+ |
| **Python** | 3.14.4（Homebrew，`/opt/homebrew/bin/python3`） |
| **Node.js** | 20.18.0 / 22.12.0（构建工具） |
| **字体** | 苹方 · 华文黑体 · 宋体（系统字体，自动注册） |

> **⚠️ 平台说明：** 本插件仅在 **macOS** 环境下开发和测试。
> 未在 Windows 或 Linux 上进行验证，无法保证其他系统下的正确运行
> （字体路径解析、Electron 对话框 API、Python 路径查找等在不同系统间存在差异）。
> 非 macOS 环境的 bug 反馈将被记录，但可能不会优先处理。

### 安装

1. 从 [GitHub Releases](https://github.com/hunter00zb/pdf-export-compress/releases) 下载最新版本
2. 解压到 vault 的 `.obsidian/plugins/pdf-export-compress/` 目录
3. 在 Obsidian 设置 → 第三方插件中启用

### 使用

1. 在 Obsidian 中打开任意 Markdown 文件
2. 在文件浏览器或编辑器中右键 → **Export PDF Compress**
3. 在弹出的对话框中选择保存位置、图片质量、最大宽度 → 点击 **Export**
4. 也可通过命令面板（Cmd/Ctrl+P）→ `Export PDF Compress`

### 命令行独立使用

Python 脚本也可以脱离 Obsidian 独立运行：

```bash
python3 md_to_pdf.py \
  --md /path/to/note.md \
  --vault /path/to/vault \
  --quality 60 \
  --max-width 900 \
  --out /path/to/output.pdf
```

### 已知限制

- **Excalidraw 图**不能直接导出 PDF。请先在 Obsidian 中将 `.excalidraw` 图导出为 PNG 或 SVG，替换引用后再执行导出。

---

## English

An Obsidian plugin that exports Markdown notes to PDF with **automatic image compression**.

Unlike other PDF export plugins that rely on browser rendering (and often produce huge files), this plugin uses **Python (reportlab + Pillow)** as the rendering engine — giving you precise control over image quality, reliable CJK font support, and significantly smaller PDF files.

### Features

- **Image compression** — JPEG quality adjustable (default 60%), max width control (default 900px)
- **SVG image support** — Embedded SVG rendered via resvg at 2x resolution
- **CJK font support** — Chinese/Japanese/Korean text renders correctly (macOS system fonts)
- **Obsidian wiki-links** — `![[image.png]]` / `![[image.svg]]` automatically resolved
- **Standard Markdown** — `![alt](image.png)` supported
- **Excalidraw guard** — Blocks export when `.excalidraw` refs are detected, with a reminder to convert to PNG/SVG first
- **Vault root image search** — Searches both vault root and attachment subfolders
- **Tables, code blocks, lists** — Full Markdown parsing
- **YAML frontmatter** — Automatically stripped

### Requirements

- **Python 3** with `reportlab`, `Pillow`, and `resvg-py` installed:

```bash
pip3 install reportlab Pillow resvg-py
```

- **macOS only** (uses system CJK fonts; Linux/Windows may need font path adjustments)

### Tested Environment

| Item | Detail |
|------|--------|
| **OS** | macOS 15 (Sequoia) · Apple Silicon (M4) |
| **Obsidian** | 1.8+ |
| **Python** | 3.14.4 (Homebrew, `/opt/homebrew/bin/python3`) |
| **Node.js** | 20.18.0 / 22.12.0 (build tool) |
| **Fonts** | PingFang SC · STHeiti · Songti SC (system fonts, auto-registered) |

> **⚠️ Platform Notice:** This plugin is developed and tested on **macOS only**.
> It has NOT been verified on Windows or Linux, and we cannot guarantee correct
> behavior on those platforms (font path resolution, Electron dialog APIs, and
> Python binary discovery differ across OSes). Bug reports from non-macOS
> environments will be noted but may not be actively addressed.

### Installation

1. Download the latest release from [GitHub Releases](https://github.com/hunter00zb/pdf-export-compress/releases)
2. Extract to `.obsidian/plugins/pdf-export-compress/` in your vault
3. Enable the plugin in Obsidian Settings → Community Plugins

### Usage

1. Open any Markdown file in Obsidian
2. Right-click the file in the file explorer or editor → **Export PDF Compress**
3. Choose save location, image quality, and max width in the dialog → click **Export**
4. Alternatively, use the Command Palette (Cmd/Ctrl+P) → `Export PDF Compress`

### CLI Usage

The Python script can also run standalone:

```bash
python3 md_to_pdf.py \
  --md /path/to/note.md \
  --vault /path/to/vault \
  --quality 60 \
  --max-width 900 \
  --out /path/to/output.pdf
```

### Known Limitations

- **Excalidraw diagrams** cannot be exported to PDF directly. Please export the `.excalidraw` diagram as PNG or SVG in Obsidian, replace the reference in MD, then export.

---

## Changelog

### v1.2.1 (2026-06-04)

- ✅ **SVG 图片支持** — 嵌入式 SVG 通过 resvg-py (zoom=2) 渲染为高清图片
- ✅ **Excalidraw 阻断守卫** — 检测到 `.excalidraw` 引用时阻止导出，提示用户先转换
- ✅ **Vault 根目录图片搜索** — 修复粘贴图片（vault 根目录）导出时丢失的问题
- ✅ **SVG 渲染清晰度提升** — `_svg_to_png()` 添加 `zoom=2` 参数
- ✅ **社区插件提交修复** — `manifest.json` name 改为 `Export PDF Compress`，符合社区插件目录规范
- ✅ 新增 `excalidraw_to_svg.py`（纯 Python Excalidraw→SVG 渲染器）

### v1.2.0 (2026-05-23)

- 初始发布至 GitHub
- 基础 PNG/JPEG 图片压缩导出
- 中文字体支持（macOS 系统字体）
- Obsidian 维基链接解析

---

## License

MIT © [hunter00zb](https://github.com/hunter00zb)
