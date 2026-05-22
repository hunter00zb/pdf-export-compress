import { Plugin, Notice, TFile, Menu, Editor, MarkdownView, Modal, App, Setting } from "obsidian";
import { exec } from "child_process";
import * as path from "path";
import * as fs from "fs";

// ────────────────────────────────────────────────────────
//  Export Destination Modal
// ────────────────────────────────────────────────────────

class ExportPdfModal extends Modal {
    private defaultPath: string;
    private defaultDir: string;
    private fileName: string;
    private inputEl!: HTMLInputElement | HTMLTextAreaElement;
    private qualityInput!: HTMLInputElement;
    private qualityDisplay!: HTMLSpanElement;
    private maxWidthInput!: HTMLInputElement;
    private onConfirm: (outPath: string, quality: number, maxWidth: number) => void;

    constructor(
        app: App,
        defaultPath: string,
        onConfirm: (outPath: string, quality: number, maxWidth: number) => void
    ) {
        super(app);
        this.defaultPath = defaultPath;
        this.defaultDir = path.dirname(defaultPath);
        this.fileName = path.basename(defaultPath);
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("export-pdf-modal");

        contentEl.createEl("h3", { text: "导出 PDF / Export to PDF" });

        // ── Output path row: textarea + "选择" button ──
        new Setting(contentEl)
            .setName("保存位置 / Save Location")
            .setDesc("默认与源文件同目录\nSame directory as source file");

        const pathRow = contentEl.createDiv({ cls: "export-pdf-path-row" });

        const textarea = pathRow.createEl("textarea", {
            cls: "export-pdf-path-input",
            attr: { rows: "2" },
        });
        textarea.value = this.defaultPath;
        this.inputEl = textarea;

        const browseBtn = pathRow.createEl("button", {
            text: "另存为 / Save As",
            cls: "export-pdf-browse-btn",
        });
        browseBtn.addEventListener("click", () => this.openSaveDialog());

        // ── Quality slider ──
        new Setting(contentEl)
            .setName("图片压缩质量 / Image Quality")
            .setDesc("推荐 60%，越低文件越小，越高画质越好\nRecommended 60%. Lower=smaller, higher=better");

        const qualityRow = contentEl.createDiv({ cls: "export-pdf-quality-row" });

        const slider = qualityRow.createEl("input", {
            type: "range",
            cls: "export-pdf-quality-slider",
            attr: { min: "10", max: "100", step: "5", value: "60" },
        });
        this.qualityInput = slider;

        const display = qualityRow.createEl("span", {
            cls: "export-pdf-quality-display",
            text: "60%",
        });
        this.qualityDisplay = display;

        slider.addEventListener("input", () => {
            display.setText(slider.value + "%");
        });

        // ── Max width ──
        const maxWidthRow = new Setting(contentEl)
            .setName("图片最大宽度 / Max Width")
            .setDesc("推荐 900px，越低文件越小，越高图片越清晰\nRecommended 900px. Lower=smaller, higher=clearer");

        const mwInput = maxWidthRow.controlEl.createEl("input", {
            type: "number",
            cls: "export-pdf-max-width-input",
            attr: { min: "200", max: "3000", step: "50", value: "900" },
        });
        this.maxWidthInput = mwInput;

        // ── Action buttons ──
        new Setting(contentEl)
            .addButton((btn) =>
                btn.setButtonText("取消 / Cancel").onClick(() => this.close())
            )
            .addButton((btn) => {
                btn.setButtonText("导出 / Export")
                    .setCta()
                    .onClick(() => {
                        const chosen = this.inputEl.value.trim();
                        if (!chosen) {
                            new Notice("[导出 PDF] 请指定保存路径 / Please specify a save path.");
                            return;
                        }
                        const quality = parseInt(this.qualityInput.value, 10) || 60;
                        const maxWidth = parseInt(this.maxWidthInput.value, 10) || 900;
                        this.close();
                        this.onConfirm(chosen, quality, maxWidth);
                    });
            });
    }

    /**
     * Open a native "Save As" dialog via Electron's dialog API.
     *
     * This gives proper "另存为" UX with both folder navigation and filename
     * editing — the standard way to choose a save destination on desktop.
     *
     * Falls back to webkitdirectory picker if the Electron dialog API is
     * unavailable (e.g. strict contextIsolation without nodeIntegration).
     */
    private async openSaveDialog() {
        // ── Attempt 1: Electron native Save dialog ──
        try {
            const w = window as any;
            if (typeof w.require === "function") {
                let dialog: any;
                try {
                    // Electron >= 14 with @electron/remote
                    dialog = w.require("@electron/remote").dialog;
                } catch {
                    try {
                        // Electron < 14 (remote module built-in)
                        dialog = w.require("electron").remote.dialog;
                    } catch {
                        // Electron with nodeIntegration (no remote)
                        dialog = w.require("electron").dialog;
                    }
                }

                if (dialog?.showSaveDialog) {
                    const result = await dialog.showSaveDialog({
                        title: "导出 PDF / Export to PDF",
                        defaultPath: this.defaultPath,
                        filters: [{ name: "PDF 文件", extensions: ["pdf"] }],
                    });
                    if (!result.canceled && result.filePath) {
                        this.inputEl.value = result.filePath;
                    }
                    return;
                }
            }
        } catch (e) {
            console.warn(
                "[Export PDF] Electron dialog unavailable, falling back to webkitdirectory:",
                e
            );
        }

        // ── Attempt 2: webkitdirectory fallback ──
        this.openWebkitDirectoryPicker();
    }

    /**
     * Fallback: HTML5 webkitdirectory picker.
     *
     * Note: this shows an "Upload" button in the native dialog (not "Save"),
     * and files[0].path may be undefined under strict contextIsolation.
     * When .path is unavailable we show a warning and ask the user to type
     * the path manually.
     */
    private openWebkitDirectoryPicker() {
        const input = document.createElement("input");
        input.type = "file";
        input.setAttribute("webkitdirectory", "");
        input.setAttribute("directory", ""); // Firefox fallback

        input.addEventListener("change", () => {
            const files = input.files;
            if (!files || files.length === 0) return;

            // Try to get the absolute path (Electron only)
            const firstPath = (files[0] as any).path as string;
            if (firstPath) {
                const selectedDir = path.dirname(firstPath);
                this.inputEl.value = path.join(selectedDir, this.fileName);
            } else {
                // .path unavailable — likely strict contextIsolation
                new Notice(
                    "[导出 PDF] 无法读取文件夹路径。\n请在上方文本框中手动输入保存路径。\nCannot read folder path from dialog. Please type the save path manually.",
                    8000
                );
            }
        });

        input.click();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


// ────────────────────────────────────────────────────────
//  Plugin
// ────────────────────────────────────────────────────────

export default class ExportPdfPlugin extends Plugin {
    private pythonCmd = "python3";
    private scriptPath = "";

    /**
     * Find a working python3 binary.
     * We try absolute paths first because exec('python3') inside Obsidian's
     * Electron shell may resolve to a different Python than the user's terminal
     * (e.g. OS-bundled python3 without site-packages).
     */
    private findPython3(): string {
        const candidates = [
            "/opt/homebrew/bin/python3",   // Homebrew Apple Silicon
            "/usr/local/bin/python3",      // Homebrew Intel / other
            "/usr/bin/python3",            // macOS bundled (Xcode CLT)
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) return p;
        }
        // Fallback: let the shell resolve it
        return "python3";
    }

    async onload() {
        // Locate the Python script in the plugin directory
        const vaultBasePath = (this.app.vault.adapter as any).basePath || "";
        this.scriptPath = path.join(
            vaultBasePath,
            ".obsidian",
            "plugins",
            "obsidian-export-pdf",
            "md_to_pdf.py"
        );

        if (!fs.existsSync(this.scriptPath)) {
            new Notice(
                "[导出 PDF] 未找到 md_to_pdf.py，请检查插件目录。\nmd_to_pdf.py not found in plugin directory.",
                8000
            );
            console.error("[Export PDF] Script not found:", this.scriptPath);
            return;
        }

        // Resolve python3 to absolute path (Electron PATH != user shell PATH)
        this.pythonCmd = this.findPython3();
        console.log("[Export PDF] Using Python:", this.pythonCmd);

        // --- Right-click menu: file explorer ---
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
                if (file.extension !== "md") return;
                menu.addItem((item) => {
                    item
                        .setTitle("导出 PDF（图片压缩）")
                        .setIcon("file-output")
                        .onClick(() => this.openExportModal(file));
                });
            })
        );

        // --- Right-click menu: editor area ---
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu: Menu, _editor: Editor, view: MarkdownView) => {
                const file = view.file;
                if (!file || file.extension !== "md") return;
                menu.addItem((item) => {
                    item
                        .setTitle("导出 PDF（图片压缩）")
                        .setIcon("file-output")
                        .onClick(() => this.openExportModal(file));
                });
            })
        );

        // --- Command palette (Cmd+P) ---
        this.addCommand({
            id: "export-pdf-with-compress",
            name: "导出 PDF（图片压缩）",
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) this.openExportModal(file);
            },
        });

        console.log("[Export PDF] Plugin loaded");
    }

    /**
     * Show the export destination modal, then export on confirm.
     */
    private openExportModal(file: TFile) {
        const vaultBasePath = (this.app.vault.adapter as any).basePath || "";
        const mdFullPath = path.join(vaultBasePath, file.path);
        const defaultOutPath = path.join(
            path.dirname(mdFullPath),
            file.basename + ".pdf"
        );

        new ExportPdfModal(this.app, defaultOutPath, (outPath: string, quality: number, maxWidth: number) => {
            this.exportFile(file, outPath, quality, maxWidth);
        }).open();
    }

    /**
     * Export a specific MD file to PDF at the given output path.
     */
    private exportFile(file: TFile, outPath: string, quality: number, maxWidth: number) {
        const vaultBasePath = (this.app.vault.adapter as any).basePath || "";
        const mdFullPath = path.join(vaultBasePath, file.path);

        // Escape paths for shell
        const esc = (p: string) => p.replace(/"/g, '\\"');

        const cmd = [
            `"${this.pythonCmd}"`,
            `"${this.scriptPath}"`,
            `--md "${esc(mdFullPath)}"`,
            `--vault "${esc(vaultBasePath)}"`,
            `--out "${esc(outPath)}"`,
            `--quality ${quality}`,
            `--max-width ${maxWidth}`,
        ].join(" ");

        const notice = new Notice("正在生成 PDF... / Generating PDF...", 0);

        exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
            notice.hide();

            if (error) {
                console.error("[Export PDF] Error:", stderr || error.message);

                // Detect common errors
                const errMsg = stderr || error.message;
                if (errMsg.includes("No module named") || errMsg.includes("ImportError") || errMsg.includes("ModuleNotFoundError")) {
                    new Notice(
                        "[导出 PDF] Python 依赖缺失，请运行: pip3 install reportlab Pillow\nPython packages missing. Run: pip3 install reportlab Pillow",
                        10000
                    );
                } else if (errMsg.includes("command not found") || errMsg.includes("ENOENT")) {
                    new Notice(
                        "[导出 PDF] 未找到 Python 3，请从 python.org 安装。\nPython 3 not found. Install from python.org.",
                        8000
                    );
                } else {
                    new Notice(
                        "[导出 PDF] 导出失败，请查看控制台（Ctrl+Shift+I）获取详情。\nExport failed. See console (Ctrl+Shift+I) for details.",
                        8000
                    );
                }
                return;
            }

            // Parse output for file size
            const sizeMatch = stdout.match(/PDF size: (.+)/);
            const sizeInfo = sizeMatch ? ` (${sizeMatch[1]})` : "";

            new Notice(
                `[导出 PDF] 完成！${sizeInfo}\nExport done!${sizeInfo}`,
                5000
            );
            console.log("[Export PDF]", stdout.trim());
        });
    }

    onunload() {
        console.log("[Export PDF] Plugin unloaded.");
    }
}
