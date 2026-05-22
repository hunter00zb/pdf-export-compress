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
    contentEl.createEl("h3", { text: "Export to PDF" });
    new import_obsidian.Setting(contentEl).setName("\u4FDD\u5B58\u4F4D\u7F6E").setDesc("\u9ED8\u8BA4\u4E0E\u6E90\u6587\u4EF6\u540C\u76EE\u5F55");
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
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    ).addButton((btn) => {
      btn.setButtonText("Export").setCta().onClick(() => {
        const chosen = this.inputEl.value.trim();
        if (!chosen) {
          new import_obsidian.Notice("[Export PDF] Please specify a save path.");
          return;
        }
        this.close();
        this.onConfirm(chosen);
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
            title: "Export to PDF",
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
          "[Export PDF] Cannot read folder path from dialog.\nPlease type the save path manually in the text field above.",
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
        "[Export PDF] md_to_pdf.py not found in plugin directory.",
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
          item.setTitle("Export to PDF (image compress)").setIcon("file-output").onClick(() => this.openExportModal(file));
        });
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, _editor, view) => {
        const file = view.file;
        if (!file || file.extension !== "md")
          return;
        menu.addItem((item) => {
          item.setTitle("Export to PDF (image compress)").setIcon("file-output").onClick(() => this.openExportModal(file));
        });
      })
    );
    this.addCommand({
      id: "export-pdf-with-compress",
      name: "Export to PDF (image compress)",
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
    new ExportPdfModal(this.app, defaultOutPath, (outPath) => {
      this.exportFile(file, outPath);
    }).open();
  }
  /**
   * Export a specific MD file to PDF at the given output path.
   */
  exportFile(file, outPath) {
    const vaultBasePath = this.app.vault.adapter.basePath || "";
    const mdFullPath = path.join(vaultBasePath, file.path);
    const esc = (p) => p.replace(/"/g, '\\"');
    const cmd = [
      `"${this.pythonCmd}"`,
      `"${this.scriptPath}"`,
      `--md "${esc(mdFullPath)}"`,
      `--vault "${esc(vaultBasePath)}"`,
      `--out "${esc(outPath)}"`,
      `--quality 60`,
      `--max-width 900`
    ].join(" ");
    const notice = new import_obsidian.Notice("Generating PDF...", 0);
    (0, import_child_process.exec)(cmd, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      notice.hide();
      if (error) {
        console.error("[Export PDF] Error:", stderr || error.message);
        const errMsg = stderr || error.message;
        if (errMsg.includes("No module named") || errMsg.includes("ImportError") || errMsg.includes("ModuleNotFoundError")) {
          new import_obsidian.Notice(
            "[Export PDF] Python packages missing. Run:\npip3 install reportlab Pillow",
            1e4
          );
        } else if (errMsg.includes("command not found") || errMsg.includes("ENOENT")) {
          new import_obsidian.Notice(
            "[Export PDF] Python 3 not found. Install from python.org",
            8e3
          );
        } else {
          new import_obsidian.Notice(
            `[Export PDF] Failed. See console (Ctrl+Shift+I) for details.`,
            8e3
          );
        }
        return;
      }
      const sizeMatch = stdout.match(/PDF size: (.+)/);
      const sizeInfo = sizeMatch ? ` (${sizeMatch[1]})` : "";
      new import_obsidian.Notice(
        `[Export PDF] Done!${sizeInfo}`,
        5e3
      );
      console.log("[Export PDF]", stdout.trim());
    });
  }
  onunload() {
    console.log("[Export PDF] Plugin unloaded.");
  }
};
