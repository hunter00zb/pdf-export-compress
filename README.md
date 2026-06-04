# Export PDF Compress

[中文](#chinese) | [English](#english)

---

## 中文

一款 Obsidian 插件，将 Markdown 笔记导出为 PDF，**支持图片自动压缩**。

与其他依赖浏览器渲染的 PDF 导出插件不同，本插件使用 **Python（reportlab + Pillow）** 作为渲染引擎，支持精确控制图片质量、可靠的中文字体渲染，生成的 PDF 文件体积显著更小。

### 功能特点

- **图片压缩** — JPEG 质量可调（默认 60%），最大宽度可控（默认 900px）
- **中文字体支持** — macOS 系统字体（苹方/黑体/宋体）自动注册
- **Obsidian 维基链接** — `![[图片名.png]]` 自动解析
- **标准 Markdown 图片** — `![alt](image.png)` 支持
- **表格、代码块、列表** — 完整 Markdown 解析
- **YAML Frontmatter** — 自动去除
- **跨目录图片搜索** — 自动在附件文件夹中查找图片

### 环境要求

- **Python 3**，需安装 `reportlab` 和 `Pillow`：

```bash
pip3 install reportlab Pillow
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
2. 在文件浏览器或编辑器中右键 → **导出 PDF（图片压缩）**
3. 在弹出的对话框中选择保存位置、图片质量、最大宽度 → 点击 **导出**
4. 也可通过命令面板（Cmd/Ctrl+P）→ `导出 PDF（图片压缩）`

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

---

## English

An Obsidian plugin that exports Markdown notes to PDF with **automatic image compression**.

Unlike other PDF export plugins that rely on browser rendering (and often produce huge files), this plugin uses **Python (reportlab + Pillow)** as the rendering engine — giving you precise control over image quality, reliable CJK font support, and significantly smaller PDF files.

### Features

- **Image compression** — JPEG quality adjustable (default 60%), max width control (default 900px)
- **CJK font support** — Chinese/Japanese/Korean text renders correctly (macOS system fonts)
- **Obsidian wiki-links** — `![[image.png]]` automatically resolved
- **Standard Markdown** — `![alt](image.png)` supported
- **Tables, code blocks, lists** — Full Markdown parsing
- **YAML frontmatter** — Automatically stripped
- **Cross-vault image search** — Finds images in attachment folders

### Requirements

- **Python 3** with `reportlab` and `Pillow` installed:

```bash
pip3 install reportlab Pillow
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
2. Right-click the file in the file explorer or editor → **Export to PDF (image compress)**
3. Choose save location, image quality, and max width in the dialog → click **Export**
4. Alternatively, use the Command Palette (Cmd/Ctrl+P) → `Export to PDF (image compress)`

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

---

## License

MIT © [hunter00zb](https://github.com/hunter00zb)
