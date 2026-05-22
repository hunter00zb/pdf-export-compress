var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ExportPdfPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_child_process = require("child_process");
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var ExportPdfModal = class extends import_obsidian.Modal {
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
    contentEl.createEl("h3", { text: "\u5BFC\u51FA PDF / Export to PDF" });
    new import_obsidian.Setting(contentEl).setName("\u4FDD\u5B58\u4F4D\u7F6E / Save Location").setDesc("\u9ED8\u8BA4\u4E0E\u6E90\u6587\u4EF6\u540C\u76EE\u5F55\nSame directory as source file");
    const pathRow = contentEl.createDiv({ cls: "export-pdf-path-row" });
    const textarea = pathRow.createEl("textarea", {
      cls: "export-pdf-path-input",
      attr: { rows: "2" }
    });
    textarea.value = this.defaultPath;
    this.inputEl = textarea;
    const browseBtn = pathRow.createEl("button", {
      text: "\u9009\u62E9",
      cls: "export-pdf-browse-btn"
    });
    browseBtn.addEventListener("click", () => this.openSaveDialog());
    new import_obsidian.Setting(contentEl).setName("\u56FE\u7247\u538B\u7F29\u8D28\u91CF / Image Quality").setDesc("\u63A8\u8350 60%\uFF0C\u8D8A\u4F4E\u6587\u4EF6\u8D8A\u5C0F\uFF0C\u8D8A\u9AD8\u753B\u8D28\u8D8A\u597D\nRecommended 60%. Lower=smaller, higher=better");
    const qualityRow = contentEl.createDiv({ cls: "export-pdf-quality-row" });
    const slider = qualityRow.createEl("input", {
      type: "range",
      cls: "export-pdf-quality-slider",
      attr: { min: "10", max: "100", step: "5", value: "60" }
    });
    this.qualityInput = slider;
    const display = qualityRow.createEl("span", {
      cls: "export-pdf-quality-display",
      text: "60%"
    });
    this.qualityDisplay = display;
    slider.addEventListener("input", () => {
      display.setText(slider.value + "%");
    });
    const maxWidthRow = new import_obsidian.Setting(contentEl).setName("\u56FE\u7247\u6700\u5927\u5BBD\u5EA6 / Max Width").setDesc("\u63A8\u8350 900px\uFF0C\u8D8A\u4F4E\u6587\u4EF6\u8D8A\u5C0F\uFF0C\u8D8A\u9AD8\u56FE\u7247\u8D8A\u6E05\u6670\nRecommended 900px. Lower=smaller, higher=clearer");
    const mwInput = maxWidthRow.controlEl.createEl("input", {
      type: "number",
      cls: "export-pdf-max-width-input",
      attr: { min: "200", max: "3000", step: "50", value: "900" }
    });
    this.maxWidthInput = mwInput;
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("\u53D6\u6D88 / Cancel").onClick(() => this.close())
    ).addButton((btn) => {
      btn.setButtonText("\u5BFC\u51FA / Export").setCta().onClick(() => {
        const chosen = this.inputEl.value.trim();
        if (!chosen) {
          new import_obsidian.Notice("[\u5BFC\u51FA PDF] \u8BF7\u6307\u5B9A\u4FDD\u5B58\u8DEF\u5F84 / Please specify a save path.");
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
  async openSaveDialog() {
    try {
      const w = window;
      if (typeof w.require === "function") {
        let dialog;
        try {
          dialog = w.require("@electron/remote").dialog;
        } catch (e) {
          try {
            dialog = w.require("electron").remote.dialog;
          } catch (e2) {
            dialog = w.require("electron").dialog;
          }
        }
        if (dialog == null ? void 0 : dialog.showSaveDialog) {
          const result = await dialog.showSaveDialog({
            title: "\u5BFC\u51FA PDF / Export to PDF",
            defaultPath: this.defaultPath,
            filters: [{ name: "PDF \u6587\u4EF6", extensions: ["pdf"] }]
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
  openWebkitDirectoryPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.addEventListener("change", () => {
      const files = input.files;
      if (!files || files.length === 0)
        return;
      const firstPath = files[0].path;
      if (firstPath) {
        const selectedDir = path.dirname(firstPath);
        this.inputEl.value = path.join(selectedDir, this.fileName);
      } else {
        new import_obsidian.Notice(
          "[\u5BFC\u51FA PDF] \u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\u5939\u8DEF\u5F84\u3002\n\u8BF7\u5728\u4E0A\u65B9\u6587\u672C\u6846\u4E2D\u624B\u52A8\u8F93\u5165\u4FDD\u5B58\u8DEF\u5F84\u3002\nCannot read folder path from dialog. Please type the save path manually.",
          8e3
        );
      }
    });
    input.click();
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var ExportPdfPlugin = class extends import_obsidian.Plugin {
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
      "/opt/homebrew/bin/python3",
      // Homebrew Apple Silicon
      "/usr/local/bin/python3",
      // Homebrew Intel / other
      "/usr/bin/python3"
      // macOS bundled (Xcode CLT)
    ];
    for (const p of candidates) {
      if (fs.existsSync(p))
        return p;
    }
    return "python3";
  }
  async onload() {
    const vaultBasePath = this.app.vault.adapter.basePath || "";
    this.scriptPath = path.join(
      vaultBasePath,
      ".obsidian",
      "plugins",
      "obsidian-export-pdf",
      "md_to_pdf.py"
    );
    if (!fs.existsSync(this.scriptPath)) {
      new import_obsidian.Notice(
        "[\u5BFC\u51FA PDF] \u672A\u627E\u5230 md_to_pdf.py\uFF0C\u8BF7\u68C0\u67E5\u63D2\u4EF6\u76EE\u5F55\u3002\nmd_to_pdf.py not found in plugin directory.",
        8e3
      );
      console.error("[Export PDF] Script not found:", this.scriptPath);
      return;
    }
    this.pythonCmd = this.findPython3();
    console.log("[Export PDF] Using Python:", this.pythonCmd);
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file.extension !== "md")
          return;
        menu.addItem((item) => {
          item.setTitle("\u5BFC\u51FA PDF\uFF08\u56FE\u7247\u538B\u7F29\uFF09").setIcon("file-output").onClick(() => this.openExportModal(file));
        });
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, _editor, view) => {
        const file = view.file;
        if (!file || file.extension !== "md")
          return;
        menu.addItem((item) => {
          item.setTitle("\u5BFC\u51FA PDF\uFF08\u56FE\u7247\u538B\u7F29\uFF09").setIcon("file-output").onClick(() => this.openExportModal(file));
        });
      })
    );
    this.addCommand({
      id: "export-pdf-with-compress",
      name: "\u5BFC\u51FA PDF\uFF08\u56FE\u7247\u538B\u7F29\uFF09",
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file)
          this.openExportModal(file);
      }
    });
    console.log("[Export PDF] Plugin loaded");
  }
  /**
   * Show the export destination modal, then export on confirm.
   */
  openExportModal(file) {
    const vaultBasePath = this.app.vault.adapter.basePath || "";
    const mdFullPath = path.join(vaultBasePath, file.path);
    const defaultOutPath = path.join(
      path.dirname(mdFullPath),
      file.basename + ".pdf"
    );
    new ExportPdfModal(this.app, defaultOutPath, (outPath, quality, maxWidth) => {
      this.exportFile(file, outPath, quality, maxWidth);
    }).open();
  }
  /**
   * Export a specific MD file to PDF at the given output path.
   */
  exportFile(file, outPath, quality, maxWidth) {
    const vaultBasePath = this.app.vault.adapter.basePath || "";
    const mdFullPath = path.join(vaultBasePath, file.path);
    const esc = (p) => p.replace(/"/g, '\\"');
    const cmd = [
      `"${this.pythonCmd}"`,
      `"${this.scriptPath}"`,
      `--md "${esc(mdFullPath)}"`,
      `--vault "${esc(vaultBasePath)}"`,
      `--out "${esc(outPath)}"`,
      `--quality ${quality}`,
      `--max-width ${maxWidth}`
    ].join(" ");
    const notice = new import_obsidian.Notice("\u6B63\u5728\u751F\u6210 PDF... / Generating PDF...", 0);
    (0, import_child_process.exec)(cmd, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      notice.hide();
      if (error) {
        console.error("[Export PDF] Error:", stderr || error.message);
        const errMsg = stderr || error.message;
        if (errMsg.includes("No module named") || errMsg.includes("ImportError") || errMsg.includes("ModuleNotFoundError")) {
          new import_obsidian.Notice(
            "[\u5BFC\u51FA PDF] Python \u4F9D\u8D56\u7F3A\u5931\uFF0C\u8BF7\u8FD0\u884C: pip3 install reportlab Pillow\nPython packages missing. Run: pip3 install reportlab Pillow",
            1e4
          );
        } else if (errMsg.includes("command not found") || errMsg.includes("ENOENT")) {
          new import_obsidian.Notice(
            "[\u5BFC\u51FA PDF] \u672A\u627E\u5230 Python 3\uFF0C\u8BF7\u4ECE python.org \u5B89\u88C5\u3002\nPython 3 not found. Install from python.org.",
            8e3
          );
        } else {
          new import_obsidian.Notice(
            "[\u5BFC\u51FA PDF] \u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u63A7\u5236\u53F0\uFF08Ctrl+Shift+I\uFF09\u83B7\u53D6\u8BE6\u60C5\u3002\nExport failed. See console (Ctrl+Shift+I) for details.",
            8e3
          );
        }
        return;
      }
      const sizeMatch = stdout.match(/PDF size: (.+)/);
      const sizeInfo = sizeMatch ? ` (${sizeMatch[1]})` : "";
      new import_obsidian.Notice(
        `[\u5BFC\u51FA PDF] \u5B8C\u6210\uFF01${sizeInfo}
Export done!${sizeInfo}`,
        5e3
      );
      console.log("[Export PDF]", stdout.trim());
    });
  }
  onunload() {
    console.log("[Export PDF] Plugin unloaded.");
  }
};
