"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const child_process_1 = require("child_process");
const path = require("path");
const fs = require("fs");
// ────────────────────────────────────────────────────────
//  Export Destination Modal
// ────────────────────────────────────────────────────────
class ExportPdfModal extends obsidian_1.Modal {
    constructor(app, defaultPath, onConfirm) {
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
        new obsidian_1.Setting(contentEl)
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
        new obsidian_1.Setting(contentEl)
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
        const maxWidthRow = new obsidian_1.Setting(contentEl)
            .setName("图片最大宽度 / Max Width")
            .setDesc("推荐 900px，越低文件越小，越高图片越清晰\nRecommended 900px. Lower=smaller, higher=clearer");
        const mwInput = maxWidthRow.controlEl.createEl("input", {
            type: "number",
            cls: "export-pdf-max-width-input",
            attr: { min: "200", max: "3000", step: "50", value: "900" },
        });
        this.maxWidthInput = mwInput;
        // ── Action buttons ──
        new obsidian_1.Setting(contentEl)
            .addButton((btn) => btn.setButtonText("取消 / Cancel").onClick(() => this.close()))
            .addButton((btn) => {
            btn.setButtonText("导出 / Export")
                .setCta()
                .onClick(() => {
                const chosen = this.inputEl.value.trim();
                if (!chosen) {
                    new obsidian_1.Notice("[导出 PDF] 请指定保存路径 / Please specify a save path.");
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
    openSaveDialog() {
        return __awaiter(this, void 0, void 0, function* () {
            // ── Attempt 1: Electron native Save dialog ──
            try {
                const w = window;
                if (typeof w.require === "function") {
                    let dialog;
                    try {
                        // Electron >= 14 with @electron/remote
                        dialog = w.require("@electron/remote").dialog;
                    }
                    catch (_a) {
                        try {
                            // Electron < 14 (remote module built-in)
                            dialog = w.require("electron").remote.dialog;
                        }
                        catch (_b) {
                            // Electron with nodeIntegration (no remote)
                            dialog = w.require("electron").dialog;
                        }
                    }
                    if (dialog === null || dialog === void 0 ? void 0 : dialog.showSaveDialog) {
                        const result = yield dialog.showSaveDialog({
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
            }
            catch (e) {
                console.warn("[Export PDF] Electron dialog unavailable, falling back to webkitdirectory:", e);
            }
            // ── Attempt 2: webkitdirectory fallback ──
            this.openWebkitDirectoryPicker();
        });
    }
    /**
     * Fallback: HTML5 webkitdirectory picker.
     *
     * Note: this shows an "Upload" button in the native dialog (not "Save"),
     * and files[0].path may be undefined under strict contextIsolation.
     * When .path is unavailable we show a warning and ask the user to type
     * the path manually.
     */
    openWebkitDirectoryPicker() {
        const input = document.createElement("input");
        input.type = "file";
        input.setAttribute("webkitdirectory", "");
        input.setAttribute("directory", ""); // Firefox fallback
        input.addEventListener("change", () => {
            const files = input.files;
            if (!files || files.length === 0)
                return;
            // Try to get the absolute path (Electron only)
            const firstPath = files[0].path;
            if (firstPath) {
                const selectedDir = path.dirname(firstPath);
                this.inputEl.value = path.join(selectedDir, this.fileName);
            }
            else {
                // .path unavailable — likely strict contextIsolation
                new obsidian_1.Notice("[导出 PDF] 无法读取文件夹路径。\n请在上方文本框中手动输入保存路径。\nCannot read folder path from dialog. Please type the save path manually.", 8000);
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
class ExportPdfPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.pythonCmd = "python3";
        this.scriptPath = "";
    }
    /**
     * Find a working python3 binary.
     * We try absolute paths first because exec('python3') inside Obsidian's
     * Electron shell may resolve to a different Python than the user's terminal
     * (e.g. OS-bundled python3 without site-packages).
     */
    findPython3() {
        const candidates = [
            "/opt/homebrew/bin/python3", // Homebrew Apple Silicon
            "/usr/local/bin/python3", // Homebrew Intel / other
            "/usr/bin/python3", // macOS bundled (Xcode CLT)
        ];
        for (const p of candidates) {
            if (fs.existsSync(p))
                return p;
        }
        // Fallback: let the shell resolve it
        return "python3";
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            // Locate the Python script in the plugin directory
            const vaultBasePath = this.app.vault.adapter.basePath || "";
            this.scriptPath = (0, obsidian_1.normalizePath)(path.join(vaultBasePath, ".obsidian", "plugins", "obsidian-export-pdf", "md_to_pdf.py"));
            if (!fs.existsSync(this.scriptPath)) {
                new obsidian_1.Notice("[导出 PDF] 未找到 md_to_pdf.py，请检查插件目录。\nmd_to_pdf.py not found in plugin directory.", 8000);
                console.error("[Export PDF] Script not found:", this.scriptPath);
                return;
            }
            // Resolve python3 to absolute path (Electron PATH != user shell PATH)
            this.pythonCmd = this.findPython3();
            console.log("[Export PDF] Using Python:", this.pythonCmd);
            // --- Right-click menu: file explorer ---
            this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
                if (file.extension !== "md")
                    return;
                menu.addItem((item) => {
                    item
                        .setTitle("导出 PDF（图片压缩）")
                        .setIcon("file-output")
                        .onClick(() => this.openExportModal(file));
                });
            }));
            // --- Right-click menu: editor area ---
            this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, view) => {
                const file = view.file;
                if (!file || file.extension !== "md")
                    return;
                menu.addItem((item) => {
                    item
                        .setTitle("导出 PDF（图片压缩）")
                        .setIcon("file-output")
                        .onClick(() => this.openExportModal(file));
                });
            }));
            // --- Command palette (Cmd+P) ---
            this.addCommand({
                id: "export-pdf-with-compress",
                name: "导出 PDF（图片压缩）",
                callback: () => {
                    const file = this.app.workspace.getActiveFile();
                    if (file)
                        this.openExportModal(file);
                },
            });
            console.log("[Export PDF] Plugin loaded");
        });
    }
    /**
     * Show the export destination modal, then export on confirm.
     */
    openExportModal(file) {
        const vaultBasePath = this.app.vault.adapter.basePath || "";
        const relPath = (0, obsidian_1.normalizePath)(file.path);
        const mdFullPath = path.join(vaultBasePath, relPath);
        const defaultOutPath = path.join(path.dirname(mdFullPath), file.basename + ".pdf");
        new ExportPdfModal(this.app, defaultOutPath, (outPath, quality, maxWidth) => {
            this.exportFile(file, outPath, quality, maxWidth);
        }).open();
    }
    /**
     * Export a specific MD file to PDF at the given output path.
     */
    exportFile(file, outPath, quality, maxWidth) {
        const vaultBasePath = this.app.vault.adapter.basePath || "";
        const relPath = (0, obsidian_1.normalizePath)(file.path);
        const mdFullPath = path.join(vaultBasePath, relPath);
        // Escape paths for shell
        const esc = (p) => p.replace(/"/g, '\\"');
        const cmd = [
            `"${this.pythonCmd}"`,
            `"${this.scriptPath}"`,
            `--md "${esc(mdFullPath)}"`,
            `--vault "${esc(vaultBasePath)}"`,
            `--out "${esc(outPath)}"`,
            `--quality ${quality}`,
            `--max-width ${maxWidth}`,
        ].join(" ");
        const notice = new obsidian_1.Notice("正在生成 PDF... / Generating PDF...", 0);
        (0, child_process_1.exec)(cmd, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
            notice.hide();
            if (error) {
                console.error("[Export PDF] Error:", stderr || error.message);
                // Detect common errors
                const errMsg = stderr || error.message;
                if (errMsg.includes("No module named") || errMsg.includes("ImportError") || errMsg.includes("ModuleNotFoundError")) {
                    new obsidian_1.Notice("[导出 PDF] Python 依赖缺失，请运行: pip3 install reportlab Pillow\nPython packages missing. Run: pip3 install reportlab Pillow", 10000);
                }
                else if (errMsg.includes("command not found") || errMsg.includes("ENOENT")) {
                    new obsidian_1.Notice("[导出 PDF] 未找到 Python 3，请从 python.org 安装。\nPython 3 not found. Install from python.org.", 8000);
                }
                else {
                    new obsidian_1.Notice("[导出 PDF] 导出失败，请查看控制台（Ctrl+Shift+I）获取详情。\nExport failed. See console (Ctrl+Shift+I) for details.", 8000);
                }
                return;
            }
            // Parse output for file size
            const sizeMatch = stdout.match(/PDF size: (.+)/);
            const sizeInfo = sizeMatch ? ` (${sizeMatch[1]})` : "";
            new obsidian_1.Notice(`[导出 PDF] 完成！${sizeInfo}\nExport done!${sizeInfo}`, 5000);
            console.log("[Export PDF]", stdout.trim());
        });
    }
    onunload() {
        console.log("[Export PDF] Plugin unloaded.");
    }
}
exports.default = ExportPdfPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL1Rlc3QgUGovb2JzaWRpYW4tZXhwb3J0LXBkZi9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsdUNBQWlIO0FBQ2pILGlEQUFxQztBQUNyQyw2QkFBNkI7QUFDN0IseUJBQXlCO0FBRXpCLDJEQUEyRDtBQUMzRCw0QkFBNEI7QUFDNUIsMkRBQTJEO0FBRTNELE1BQU0sY0FBZSxTQUFRLGdCQUFLO0lBVTlCLFlBQ0ksR0FBUSxFQUNSLFdBQW1CLEVBQ25CLFNBQXVFO1FBRXZFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNYLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM1QyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7SUFDL0IsQ0FBQztJQUVELE1BQU07UUFDRixNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQzNCLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNsQixTQUFTLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFdkMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDO1FBRTdELGdEQUFnRDtRQUNoRCxJQUFJLGtCQUFPLENBQUMsU0FBUyxDQUFDO2FBQ2pCLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQzthQUMvQixPQUFPLENBQUMsMENBQTBDLENBQUMsQ0FBQztRQUV6RCxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxFQUFFLHFCQUFxQixF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LENBQUMsRUFBRSxDQUFDO29CQUNqSCxJQUFJLGlCQUFNLENBQ04sc0hBQXNILEVBQ3RILEtBQUssQ0FDUixDQUFDO2dCQUNOLENBQUM7cUJBQU0sSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO29CQUMzRSxJQUFJLGlCQUFNLENBQ04sdUZBQXVGLEVBQ3ZGLElBQUksQ0FDUCxDQUFDO2dCQUNOLENBQUM7cUJBQU0sQ0FBQztvQkFDSixJQUFJLGlCQUFNLENBQ04saUdBQWlHLEVBQ2pHLElBQUksQ0FDUCxDQUFDO2dCQUNOLENBQUM7Z0JBQ0QsT0FBTztZQUNYLENBQUM7WUFFRCw2QkFBNkI7WUFDN0IsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBRXZELElBQUksaUJBQU0sQ0FDTixlQUFlLFFBQVEsaUJBQWlCLFFBQVEsRUFBRSxFQUNsRCxJQUFJLENBQ1AsQ0FBQztZQUNGLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVELFFBQVE7UUFDSixPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixDQUFDLENBQUM7SUFDakQsQ0FBQztDQUNKO0FBektELGtDQXlLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBsdWdpbiwgTm90aWNlLCBURmlsZSwgTWVudSwgRWRpdG9yLCBNYXJrZG93blZpZXcsIE1vZGFsLCBBcHAsIFNldHRpbmcsIG5vcm1hbGl6ZVBhdGggfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGV4ZWMgfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzXCI7XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gIEV4cG9ydCBEZXN0aW5hdGlvbiBNb2RhbFxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbmNsYXNzIEV4cG9ydFBkZk1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICAgIHByaXZhdGUgZGVmYXVsdFBhdGg6IHN0cmluZztcbiAgICBwcml2YXRlIGRlZmF1bHREaXI6IHN0cmluZztcbiAgICBwcml2YXRlIGZpbGVOYW1lOiBzdHJpbmc7XG4gICAgcHJpdmF0ZSBpbnB1dEVsITogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBxdWFsaXR5SW5wdXQhOiBIVE1MSW5wdXRFbGVtZW50O1xuICAgIHByaXZhdGUgcXVhbGl0eURpc3BsYXkhOiBIVE1MU3BhbkVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBtYXhXaWR0aElucHV0ITogSFRNTElucHV0RWxlbWVudDtcbiAgICBwcml2YXRlIG9uQ29uZmlybTogKG91dFBhdGg6IHN0cmluZywgcXVhbGl0eTogbnVtYmVyLCBtYXhXaWR0aDogbnVtYmVyKSA9PiB2b2lkO1xuXG4gICAgY29uc3RydWN0b3IoXG4gICAgICAgIGFwcDogQXBwLFxuICAgICAgICBkZWZhdWx0UGF0aDogc3RyaW5nLFxuICAgICAgICBvbkNvbmZpcm06IChvdXRQYXRoOiBzdHJpbmcsIHF1YWxpdHk6IG51bWJlciwgbWF4V2lkdGg6IG51bWJlcikgPT4gdm9pZFxuICAgICkge1xuICAgICAgICBzdXBlcihhcHApO1xuICAgICAgICB0aGlzLmRlZmF1bHRQYXRoID0gZGVmYXVsdFBhdGg7XG4gICAgICAgIHRoaXMuZGVmYXVsdERpciA9IHBhdGguZGlybmFtZShkZWZhdWx0UGF0aCk7XG4gICAgICAgIHRoaXMuZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKGRlZmF1bHRQYXRoKTtcbiAgICAgICAgdGhpcy5vbkNvbmZpcm0gPSBvbkNvbmZpcm07XG4gICAgfVxuXG4gICAgb25PcGVuKCkge1xuICAgICAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICAgICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgICAgIGNvbnRlbnRFbC5hZGRDbGFzcyhcImV4cG9ydC1wZGYtbW9kYWxcIik7XG5cbiAgICAgICAgY29udGVudEVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIuWvvOWHuiBQREYgLyBFeHBvcnQgdG8gUERGXCIgfSk7XG5cbiAgICAgICAgLy8g4pSA4pSAIE91dHB1dCBwYXRoIHJvdzogdGV4dGFyZWEgKyBcIumAieaLqVwiIGJ1dHRvbiDilIDilIBcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCLkv53lrZjkvY3nva4gLyBTYXZlIExvY2F0aW9uXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcIum7mOiupOS4jua6kOaWh+S7tuWQjOebruW9lVxcblNhbWUgZGlyZWN0b3J5IGFzIHNvdXJjZSBmaWxlXCIpO1xuXG4gICAgICAgIGNvbnN0IHBhdGhSb3cgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImV4cG9ydC1wZGYtcGF0aC1yb3dcIiB9KTtcblxuICAgICAgICBjb25zdCB0ZXh0YXJlYSA9IHBhdGhSb3cuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwiZXhwb3J0LXBkZi1wYXRoLWlucHV0XCIsXG4gICAgICAgICAgICBhdHRyOiB7IHJvd3M6IFwiMlwiIH0sXG4gICAgICAgIH0pO1xuICAgICAgICB0ZXh0YXJlYS52YWx1ZSA9IHRoaXMuZGVmYXVsdFBhdGg7XG4gICAgICAgIHRoaXMuaW5wdXRFbCA9IHRleHRhcmVhO1xuXG4gICAgICAgIGNvbnN0IGJyb3dzZUJ0biA9IHBhdGhSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICAgICAgdGV4dDogXCLlj6blrZjkuLogLyBTYXZlIEFzXCIsXG4gICAgICAgICAgICBjbHM6IFwiZXhwb3J0LXBkZi1icm93c2UtYnRuXCIsXG4gICAgICAgIH0pO1xuICAgICAgICBicm93c2VCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMub3BlblNhdmVEaWFsb2coKSk7XG5cbiAgICAgICAgLy8g4pSA4pSAIFF1YWxpdHkgc2xpZGVyIOKUgOKUgFxuICAgICAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIuWbvueJh+WOi+e8qei0qOmHjyAvIEltYWdlIFF1YWxpdHlcIilcbiAgICAgICAgICAgIC5zZXREZXNjKFwi5o6o6I2QIDYwJe+8jOi2iuS9juaWh+S7tui2iuWwj++8jOi2iumrmOeUu+i0qOi2iuWlvVxcblJlY29tbWVuZGVkIDYwJS4gTG93ZXI9c21hbGxlciwgaGlnaGVyPWJldHRlclwiKTtcblxuICAgICAgICBjb25zdCBxdWFsaXR5Um93ID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJleHBvcnQtcGRmLXF1YWxpdHktcm93XCIgfSk7XG5cbiAgICAgICAgY29uc3Qgc2xpZGVyID0gcXVhbGl0eVJvdy5jcmVhdGVFbChcImlucHV0XCIsIHtcbiAgICAgICAgICAgIHR5cGU6IFwicmFuZ2VcIixcbiAgICAgICAgICAgIGNsczogXCJleHBvcnQtcGRmLXF1YWxpdHktc2xpZGVyXCIsXG4gICAgICAgICAgICBhdHRyOiB7IG1pbjogXCIxMFwiLCBtYXg6IFwiMTAwXCIsIHN0ZXA6IFwiNVwiLCB2YWx1ZTogXCI2MFwiIH0sXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnF1YWxpdHlJbnB1dCA9IHNsaWRlcjtcblxuICAgICAgICBjb25zdCBkaXNwbGF5ID0gcXVhbGl0eVJvdy5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgICAgICAgY2xzOiBcImV4cG9ydC1wZGYtcXVhbGl0eS1kaXNwbGF5XCIsXG4gICAgICAgICAgICB0ZXh0OiBcIjYwJVwiLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5xdWFsaXR5RGlzcGxheSA9IGRpc3BsYXk7XG5cbiAgICAgICAgc2xpZGVyLmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgICAgICAgICBkaXNwbGF5LnNldFRleHQoc2xpZGVyLnZhbHVlICsgXCIlXCIpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyDilIDilIAgTWF4IHdpZHRoIOKUgOKUgFxuICAgICAgICBjb25zdCBtYXhXaWR0aFJvdyA9IG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgICAgICAgIC5zZXROYW1lKFwi5Zu+54mH5pyA5aSn5a695bqmIC8gTWF4IFdpZHRoXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcIuaOqOiNkCA5MDBweO+8jOi2iuS9juaWh+S7tui2iuWwj++8jOi2iumrmOWbvueJh+i2iua4heaZsFxcblJlY29tbWVuZGVkIDkwMHB4LiBMb3dlcj1zbWFsbGVyLCBoaWdoZXI9Y2xlYXJlclwiKTtcblxuICAgICAgICBjb25zdCBtd0lucHV0ID0gbWF4V2lkdGhSb3cuY29udHJvbEVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuICAgICAgICAgICAgdHlwZTogXCJudW1iZXJcIixcbiAgICAgICAgICAgIGNsczogXCJleHBvcnQtcGRmLW1heC13aWR0aC1pbnB1dFwiLFxuICAgICAgICAgICAgYXR0cjogeyBtaW46IFwiMjAwXCIsIG1heDogXCIzMDAwXCIsIHN0ZXA6IFwiNTBcIiwgdmFsdWU6IFwiOTAwXCIgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMubWF4V2lkdGhJbnB1dCA9IG13SW5wdXQ7XG5cbiAgICAgICAgLy8g4pSA4pSAIEFjdGlvbiBidXR0b25zIOKUgOKUgFxuICAgICAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAgICAgICAuYWRkQnV0dG9uKChidG4pID0+XG4gICAgICAgICAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoXCLlj5bmtoggLyBDYW5jZWxcIikub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuYWRkQnV0dG9uKChidG4pID0+IHtcbiAgICAgICAgICAgICAgICBidG4uc2V0QnV0dG9uVGV4dChcIuWvvOWHuiAvIEV4cG9ydFwiKVxuICAgICAgICAgICAgICAgICAgICAuc2V0Q3RhKClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hvc2VuID0gdGhpcy5pbnB1dEVsLnZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2hvc2VuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcIlvlr7zlh7ogUERGXSDor7fmjIflrprkv53lrZjot6/lvoQgLyBQbGVhc2Ugc3BlY2lmeSBhIHNhdmUgcGF0aC5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcXVhbGl0eSA9IHBhcnNlSW50KHRoaXMucXVhbGl0eUlucHV0LnZhbHVlLCAxMCkgfHwgNjA7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXhXaWR0aCA9IHBhcnNlSW50KHRoaXMubWF4V2lkdGhJbnB1dC52YWx1ZSwgMTApIHx8IDkwMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25Db25maXJtKGNob3NlbiwgcXVhbGl0eSwgbWF4V2lkdGgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE9wZW4gYSBuYXRpdmUgXCJTYXZlIEFzXCIgZGlhbG9nIHZpYSBFbGVjdHJvbidzIGRpYWxvZyBBUEkuXG4gICAgICpcbiAgICAgKiBUaGlzIGdpdmVzIHByb3BlciBcIuWPpuWtmOS4ulwiIFVYIHdpdGggYm90aCBmb2xkZXIgbmF2aWdhdGlvbiBhbmQgZmlsZW5hbWVcbiAgICAgKiBlZGl0aW5nIOKAlCB0aGUgc3RhbmRhcmQgd2F5IHRvIGNob29zZSBhIHNhdmUgZGVzdGluYXRpb24gb24gZGVza3RvcC5cbiAgICAgKlxuICAgICAqIEZhbGxzIGJhY2sgdG8gd2Via2l0ZGlyZWN0b3J5IHBpY2tlciBpZiB0aGUgRWxlY3Ryb24gZGlhbG9nIEFQSSBpc1xuICAgICAqIHVuYXZhaWxhYmxlIChlLmcuIHN0cmljdCBjb250ZXh0SXNvbGF0aW9uIHdpdGhvdXQgbm9kZUludGVncmF0aW9uKS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIG9wZW5TYXZlRGlhbG9nKCkge1xuICAgICAgICAvLyDilIDilIAgQXR0ZW1wdCAxOiBFbGVjdHJvbiBuYXRpdmUgU2F2ZSBkaWFsb2cg4pSA4pSAXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB3ID0gd2luZG93IGFzIGFueTtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygdy5yZXF1aXJlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICBsZXQgZGlhbG9nOiBhbnk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRWxlY3Ryb24gPj0gMTQgd2l0aCBAZWxlY3Ryb24vcmVtb3RlXG4gICAgICAgICAgICAgICAgICAgIGRpYWxvZyA9IHcucmVxdWlyZShcIkBlbGVjdHJvbi9yZW1vdGVcIikuZGlhbG9nO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRWxlY3Ryb24gPCAxNCAocmVtb3RlIG1vZHVsZSBidWlsdC1pbilcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpYWxvZyA9IHcucmVxdWlyZShcImVsZWN0cm9uXCIpLnJlbW90ZS5kaWFsb2c7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRWxlY3Ryb24gd2l0aCBub2RlSW50ZWdyYXRpb24gKG5vIHJlbW90ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpYWxvZyA9IHcucmVxdWlyZShcImVsZWN0cm9uXCIpLmRpYWxvZztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChkaWFsb2c/LnNob3dTYXZlRGlhbG9nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRpYWxvZy5zaG93U2F2ZURpYWxvZyh7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCLlr7zlh7ogUERGIC8gRXhwb3J0IHRvIFBERlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdFBhdGg6IHRoaXMuZGVmYXVsdFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWx0ZXJzOiBbeyBuYW1lOiBcIlBERiDmlofku7ZcIiwgZXh0ZW5zaW9uczogW1wicGRmXCJdIH1dLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXN1bHQuY2FuY2VsZWQgJiYgcmVzdWx0LmZpbGVQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmlucHV0RWwudmFsdWUgPSByZXN1bHQuZmlsZVBhdGg7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgIFwiW0V4cG9ydCBQREZdIEVsZWN0cm9uIGRpYWxvZyB1bmF2YWlsYWJsZSwgZmFsbGluZyBiYWNrIHRvIHdlYmtpdGRpcmVjdG9yeTpcIixcbiAgICAgICAgICAgICAgICBlXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g4pSA4pSAIEF0dGVtcHQgMjogd2Via2l0ZGlyZWN0b3J5IGZhbGxiYWNrIOKUgOKUgFxuICAgICAgICB0aGlzLm9wZW5XZWJraXREaXJlY3RvcnlQaWNrZXIoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGYWxsYmFjazogSFRNTDUgd2Via2l0ZGlyZWN0b3J5IHBpY2tlci5cbiAgICAgKlxuICAgICAqIE5vdGU6IHRoaXMgc2hvd3MgYW4gXCJVcGxvYWRcIiBidXR0b24gaW4gdGhlIG5hdGl2ZSBkaWFsb2cgKG5vdCBcIlNhdmVcIiksXG4gICAgICogYW5kIGZpbGVzWzBdLnBhdGggbWF5IGJlIHVuZGVmaW5lZCB1bmRlciBzdHJpY3QgY29udGV4dElzb2xhdGlvbi5cbiAgICAgKiBXaGVuIC5wYXRoIGlzIHVuYXZhaWxhYmxlIHdlIHNob3cgYSB3YXJuaW5nIGFuZCBhc2sgdGhlIHVzZXIgdG8gdHlwZVxuICAgICAqIHRoZSBwYXRoIG1hbnVhbGx5LlxuICAgICAqL1xuICAgIHByaXZhdGUgb3BlbldlYmtpdERpcmVjdG9yeVBpY2tlcigpIHtcbiAgICAgICAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIik7XG4gICAgICAgIGlucHV0LnR5cGUgPSBcImZpbGVcIjtcbiAgICAgICAgaW5wdXQuc2V0QXR0cmlidXRlKFwid2Via2l0ZGlyZWN0b3J5XCIsIFwiXCIpO1xuICAgICAgICBpbnB1dC5zZXRBdHRyaWJ1dGUoXCJkaXJlY3RvcnlcIiwgXCJcIik7IC8vIEZpcmVmb3ggZmFsbGJhY2tcblxuICAgICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gaW5wdXQuZmlsZXM7XG4gICAgICAgICAgICBpZiAoIWZpbGVzIHx8IGZpbGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgICAgICAgICAvLyBUcnkgdG8gZ2V0IHRoZSBhYnNvbHV0ZSBwYXRoIChFbGVjdHJvbiBvbmx5KVxuICAgICAgICAgICAgY29uc3QgZmlyc3RQYXRoID0gKGZpbGVzWzBdIGFzIGFueSkucGF0aCBhcyBzdHJpbmc7XG4gICAgICAgICAgICBpZiAoZmlyc3RQYXRoKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWREaXIgPSBwYXRoLmRpcm5hbWUoZmlyc3RQYXRoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmlucHV0RWwudmFsdWUgPSBwYXRoLmpvaW4oc2VsZWN0ZWREaXIsIHRoaXMuZmlsZU5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyAucGF0aCB1bmF2YWlsYWJsZSDigJQgbGlrZWx5IHN0cmljdCBjb250ZXh0SXNvbGF0aW9uXG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgXCJb5a+85Ye6IFBERl0g5peg5rOV6K+75Y+W5paH5Lu25aS56Lev5b6E44CCXFxu6K+35Zyo5LiK5pa55paH5pys5qGG5Lit5omL5Yqo6L6T5YWl5L+d5a2Y6Lev5b6E44CCXFxuQ2Fubm90IHJlYWQgZm9sZGVyIHBhdGggZnJvbSBkaWFsb2cuIFBsZWFzZSB0eXBlIHRoZSBzYXZlIHBhdGggbWFudWFsbHkuXCIsXG4gICAgICAgICAgICAgICAgICAgIDgwMDBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpbnB1dC5jbGljaygpO1xuICAgIH1cblxuICAgIG9uQ2xvc2UoKSB7XG4gICAgICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgICAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICB9XG59XG5cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyAgUGx1Z2luXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXhwb3J0UGRmUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgICBwcml2YXRlIHB5dGhvbkNtZCA9IFwicHl0aG9uM1wiO1xuICAgIHByaXZhdGUgc2NyaXB0UGF0aCA9IFwiXCI7XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIGEgd29ya2luZyBweXRob24zIGJpbmFyeS5cbiAgICAgKiBXZSB0cnkgYWJzb2x1dGUgcGF0aHMgZmlyc3QgYmVjYXVzZSBleGVjKCdweXRob24zJykgaW5zaWRlIE9ic2lkaWFuJ3NcbiAgICAgKiBFbGVjdHJvbiBzaGVsbCBtYXkgcmVzb2x2ZSB0byBhIGRpZmZlcmVudCBQeXRob24gdGhhbiB0aGUgdXNlcidzIHRlcm1pbmFsXG4gICAgICogKGUuZy4gT1MtYnVuZGxlZCBweXRob24zIHdpdGhvdXQgc2l0ZS1wYWNrYWdlcykuXG4gICAgICovXG4gICAgcHJpdmF0ZSBmaW5kUHl0aG9uMygpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBjYW5kaWRhdGVzID0gW1xuICAgICAgICAgICAgXCIvb3B0L2hvbWVicmV3L2Jpbi9weXRob24zXCIsICAgLy8gSG9tZWJyZXcgQXBwbGUgU2lsaWNvblxuICAgICAgICAgICAgXCIvdXNyL2xvY2FsL2Jpbi9weXRob24zXCIsICAgICAgLy8gSG9tZWJyZXcgSW50ZWwgLyBvdGhlclxuICAgICAgICAgICAgXCIvdXNyL2Jpbi9weXRob24zXCIsICAgICAgICAgICAgLy8gbWFjT1MgYnVuZGxlZCAoWGNvZGUgQ0xUKVxuICAgICAgICBdO1xuICAgICAgICBmb3IgKGNvbnN0IHAgb2YgY2FuZGlkYXRlcykge1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocCkpIHJldHVybiBwO1xuICAgICAgICB9XG4gICAgICAgIC8vIEZhbGxiYWNrOiBsZXQgdGhlIHNoZWxsIHJlc29sdmUgaXRcbiAgICAgICAgcmV0dXJuIFwicHl0aG9uM1wiO1xuICAgIH1cblxuICAgIGFzeW5jIG9ubG9hZCgpIHtcbiAgICAgICAgLy8gTG9jYXRlIHRoZSBQeXRob24gc2NyaXB0IGluIHRoZSBwbHVnaW4gZGlyZWN0b3J5XG4gICAgICAgIGNvbnN0IHZhdWx0QmFzZVBhdGggPSAodGhpcy5hcHAudmF1bHQuYWRhcHRlciBhcyBhbnkpLmJhc2VQYXRoIHx8IFwiXCI7XG4gICAgICAgIHRoaXMuc2NyaXB0UGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aC5qb2luKFxuICAgICAgICAgICAgdmF1bHRCYXNlUGF0aCxcbiAgICAgICAgICAgIFwiLm9ic2lkaWFuXCIsXG4gICAgICAgICAgICBcInBsdWdpbnNcIixcbiAgICAgICAgICAgIFwib2JzaWRpYW4tZXhwb3J0LXBkZlwiLFxuICAgICAgICAgICAgXCJtZF90b19wZGYucHlcIlxuICAgICAgICApKTtcblxuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmModGhpcy5zY3JpcHRQYXRoKSkge1xuICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICBcIlvlr7zlh7ogUERGXSDmnKrmib7liLAgbWRfdG9fcGRmLnB577yM6K+35qOA5p+l5o+S5Lu255uu5b2V44CCXFxubWRfdG9fcGRmLnB5IG5vdCBmb3VuZCBpbiBwbHVnaW4gZGlyZWN0b3J5LlwiLFxuICAgICAgICAgICAgICAgIDgwMDBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW0V4cG9ydCBQREZdIFNjcmlwdCBub3QgZm91bmQ6XCIsIHRoaXMuc2NyaXB0UGF0aCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNvbHZlIHB5dGhvbjMgdG8gYWJzb2x1dGUgcGF0aCAoRWxlY3Ryb24gUEFUSCAhPSB1c2VyIHNoZWxsIFBBVEgpXG4gICAgICAgIHRoaXMucHl0aG9uQ21kID0gdGhpcy5maW5kUHl0aG9uMygpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIltFeHBvcnQgUERGXSBVc2luZyBQeXRob246XCIsIHRoaXMucHl0aG9uQ21kKTtcblxuICAgICAgICAvLyAtLS0gUmlnaHQtY2xpY2sgbWVudTogZmlsZSBleHBsb3JlciAtLS1cbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1tZW51XCIsIChtZW51OiBNZW51LCBmaWxlOiBURmlsZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm47XG4gICAgICAgICAgICAgICAgbWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZXRUaXRsZShcIuWvvOWHuiBQREbvvIjlm77niYfljovnvKnvvIlcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZXRJY29uKFwiZmlsZS1vdXRwdXRcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMub3BlbkV4cG9ydE1vZGFsKGZpbGUpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gLS0tIFJpZ2h0LWNsaWNrIG1lbnU6IGVkaXRvciBhcmVhIC0tLVxuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJlZGl0b3ItbWVudVwiLCAobWVudTogTWVudSwgX2VkaXRvcjogRWRpdG9yLCB2aWV3OiBNYXJrZG93blZpZXcpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0gdmlldy5maWxlO1xuICAgICAgICAgICAgICAgIGlmICghZmlsZSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm47XG4gICAgICAgICAgICAgICAgbWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZXRUaXRsZShcIuWvvOWHuiBQREbvvIjlm77niYfljovnvKnvvIlcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZXRJY29uKFwiZmlsZS1vdXRwdXRcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMub3BlbkV4cG9ydE1vZGFsKGZpbGUpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gLS0tIENvbW1hbmQgcGFsZXR0ZSAoQ21kK1ApIC0tLVxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgICAgICAgaWQ6IFwiZXhwb3J0LXBkZi13aXRoLWNvbXByZXNzXCIsXG4gICAgICAgICAgICBuYW1lOiBcIuWvvOWHuiBQREbvvIjlm77niYfljovnvKnvvIlcIixcbiAgICAgICAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgICAgICAgICAgaWYgKGZpbGUpIHRoaXMub3BlbkV4cG9ydE1vZGFsKGZpbGUpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc29sZS5sb2coXCJbRXhwb3J0IFBERl0gUGx1Z2luIGxvYWRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaG93IHRoZSBleHBvcnQgZGVzdGluYXRpb24gbW9kYWwsIHRoZW4gZXhwb3J0IG9uIGNvbmZpcm0uXG4gICAgICovXG4gICAgcHJpdmF0ZSBvcGVuRXhwb3J0TW9kYWwoZmlsZTogVEZpbGUpIHtcbiAgICAgICAgY29uc3QgdmF1bHRCYXNlUGF0aCA9ICh0aGlzLmFwcC52YXVsdC5hZGFwdGVyIGFzIGFueSkuYmFzZVBhdGggfHwgXCJcIjtcbiAgICAgICAgY29uc3QgcmVsUGF0aCA9IG5vcm1hbGl6ZVBhdGgoZmlsZS5wYXRoKTtcbiAgICAgICAgY29uc3QgbWRGdWxsUGF0aCA9IHBhdGguam9pbih2YXVsdEJhc2VQYXRoLCByZWxQYXRoKTtcbiAgICAgICAgY29uc3QgZGVmYXVsdE91dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICAgICAgICBwYXRoLmRpcm5hbWUobWRGdWxsUGF0aCksXG4gICAgICAgICAgICBmaWxlLmJhc2VuYW1lICsgXCIucGRmXCJcbiAgICAgICAgKTtcblxuICAgICAgICBuZXcgRXhwb3J0UGRmTW9kYWwodGhpcy5hcHAsIGRlZmF1bHRPdXRQYXRoLCAob3V0UGF0aDogc3RyaW5nLCBxdWFsaXR5OiBudW1iZXIsIG1heFdpZHRoOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZXhwb3J0RmlsZShmaWxlLCBvdXRQYXRoLCBxdWFsaXR5LCBtYXhXaWR0aCk7XG4gICAgICAgIH0pLm9wZW4oKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeHBvcnQgYSBzcGVjaWZpYyBNRCBmaWxlIHRvIFBERiBhdCB0aGUgZ2l2ZW4gb3V0cHV0IHBhdGguXG4gICAgICovXG4gICAgcHJpdmF0ZSBleHBvcnRGaWxlKGZpbGU6IFRGaWxlLCBvdXRQYXRoOiBzdHJpbmcsIHF1YWxpdHk6IG51bWJlciwgbWF4V2lkdGg6IG51bWJlcikge1xuICAgICAgICBjb25zdCB2YXVsdEJhc2VQYXRoID0gKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgYXMgYW55KS5iYXNlUGF0aCB8fCBcIlwiO1xuICAgICAgICBjb25zdCByZWxQYXRoID0gbm9ybWFsaXplUGF0aChmaWxlLnBhdGgpO1xuICAgICAgICBjb25zdCBtZEZ1bGxQYXRoID0gcGF0aC5qb2luKHZhdWx0QmFzZVBhdGgsIHJlbFBhdGgpO1xuXG4gICAgICAgIC8vIEVzY2FwZSBwYXRocyBmb3Igc2hlbGxcbiAgICAgICAgY29uc3QgZXNjID0gKHA6IHN0cmluZykgPT4gcC5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJyk7XG5cbiAgICAgICAgY29uc3QgY21kID0gW1xuICAgICAgICAgICAgYFwiJHt0aGlzLnB5dGhvbkNtZH1cImAsXG4gICAgICAgICAgICBgXCIke3RoaXMuc2NyaXB0UGF0aH1cImAsXG4gICAgICAgICAgICBgLS1tZCBcIiR7ZXNjKG1kRnVsbFBhdGgpfVwiYCxcbiAgICAgICAgICAgIGAtLXZhdWx0IFwiJHtlc2ModmF1bHRCYXNlUGF0aCl9XCJgLFxuICAgICAgICAgICAgYC0tb3V0IFwiJHtlc2Mob3V0UGF0aCl9XCJgLFxuICAgICAgICAgICAgYC0tcXVhbGl0eSAke3F1YWxpdHl9YCxcbiAgICAgICAgICAgIGAtLW1heC13aWR0aCAke21heFdpZHRofWAsXG4gICAgICAgIF0uam9pbihcIiBcIik7XG5cbiAgICAgICAgY29uc3Qgbm90aWNlID0gbmV3IE5vdGljZShcIuato+WcqOeUn+aIkCBQREYuLi4gLyBHZW5lcmF0aW5nIFBERi4uLlwiLCAwKTtcblxuICAgICAgICBleGVjKGNtZCwgeyBtYXhCdWZmZXI6IDIwICogMTAyNCAqIDEwMjQgfSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgbm90aWNlLmhpZGUoKTtcblxuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIltFeHBvcnQgUERGXSBFcnJvcjpcIiwgc3RkZXJyIHx8IGVycm9yLm1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gRGV0ZWN0IGNvbW1vbiBlcnJvcnNcbiAgICAgICAgICAgICAgICBjb25zdCBlcnJNc2cgPSBzdGRlcnIgfHwgZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyTXNnLmluY2x1ZGVzKFwiTm8gbW9kdWxlIG5hbWVkXCIpIHx8IGVyck1zZy5pbmNsdWRlcyhcIkltcG9ydEVycm9yXCIpIHx8IGVyck1zZy5pbmNsdWRlcyhcIk1vZHVsZU5vdEZvdW5kRXJyb3JcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiW+WvvOWHuiBQREZdIFB5dGhvbiDkvp3otZbnvLrlpLHvvIzor7fov5DooYw6IHBpcDMgaW5zdGFsbCByZXBvcnRsYWIgUGlsbG93XFxuUHl0aG9uIHBhY2thZ2VzIG1pc3NpbmcuIFJ1bjogcGlwMyBpbnN0YWxsIHJlcG9ydGxhYiBQaWxsb3dcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIDEwMDAwXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlcnJNc2cuaW5jbHVkZXMoXCJjb21tYW5kIG5vdCBmb3VuZFwiKSB8fCBlcnJNc2cuaW5jbHVkZXMoXCJFTk9FTlRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiW+WvvOWHuiBQREZdIOacquaJvuWIsCBQeXRob24gM++8jOivt+S7jiBweXRob24ub3JnIOWuieijheOAglxcblB5dGhvbiAzIG5vdCBmb3VuZC4gSW5zdGFsbCBmcm9tIHB5dGhvbi5vcmcuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICA4MDAwXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiW+WvvOWHuiBQREZdIOWvvOWHuuWksei0pe+8jOivt+afpeeci+aOp+WItuWPsO+8iEN0cmwrU2hpZnQrSe+8ieiOt+WPluivpuaDheOAglxcbkV4cG9ydCBmYWlsZWQuIFNlZSBjb25zb2xlIChDdHJsK1NoaWZ0K0kpIGZvciBkZXRhaWxzLlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgODAwMFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIG91dHB1dCBmb3IgZmlsZSBzaXplXG4gICAgICAgICAgICBjb25zdCBzaXplTWF0Y2ggPSBzdGRvdXQubWF0Y2goL1BERiBzaXplOiAoLispLyk7XG4gICAgICAgICAgICBjb25zdCBzaXplSW5mbyA9IHNpemVNYXRjaCA/IGAgKCR7c2l6ZU1hdGNoWzFdfSlgIDogXCJcIjtcblxuICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICBgW+WvvOWHuiBQREZdIOWujOaIkO+8gSR7c2l6ZUluZm99XFxuRXhwb3J0IGRvbmUhJHtzaXplSW5mb31gLFxuICAgICAgICAgICAgICAgIDUwMDBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIltFeHBvcnQgUERGXVwiLCBzdGRvdXQudHJpbSgpKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgb251bmxvYWQoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiW0V4cG9ydCBQREZdIFBsdWdpbiB1bmxvYWRlZC5cIik7XG4gICAgfVxufVxuIl19