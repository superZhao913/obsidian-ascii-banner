import { MarkdownRenderChild, Notice, Plugin, TFile, requestUrl } from "obsidian";
import { AsciiRuntime } from "./ascii-runtime";
import { BannerPickerModal } from "./banner-modal";
import { catalogItemToConfig } from "./banner-modal-helpers";
import { createBundledCatalog, refreshRemoteCatalog } from "./catalog";
import { clearBannerConfig, readBannerConfig, writeBannerConfig } from "./frontmatter";
import { createLivePreviewExtension } from "./live-preview";
import { createMarkdownPostProcessor } from "./markdown-renderer";
import type { BannerConfig, PieceCatalogItem } from "./types";

export const REFRESH_EVENT = "ascii-banner:refresh";

export default class AsciiBannerPlugin extends Plugin {
  private runtime!: AsciiRuntime;
  private catalog!: PieceCatalogItem[];
  private knownSlugs!: Set<string>;

  override async onload(): Promise<void> {
    this.runtime = new AsciiRuntime();
    this.catalog = createBundledCatalog();
    this.knownSlugs = new Set(this.catalog.map((item) => item.slug));

    this.registerMarkdownPostProcessor(
      createMarkdownPostProcessor(
        { getConfig: (path) => this.configForPath(path), runtime: this.runtime },
        MarkdownRenderChild,
      ),
    );

    this.registerEditorExtension(
      createLivePreviewExtension({ runtime: this.runtime, knownSlugs: this.knownSlugs }),
    );

    this.addCommand({
      id: "set-ascii-banner",
      name: "设置 / 更换 ASCII Banner 图案",
      callback: () => this.openBannerPicker(),
    });

    this.addCommand({
      id: "clear-ascii-banner",
      name: "清除 ASCII Banner",
      callback: () => this.clearBanner(),
    });

    this.addCommand({
      id: "toggle-ascii-banner-animation",
      name: "切换 ASCII Banner：动画 ⇄ 静止",
      callback: () => this.toggleAnimation(),
    });

    this.addCommand({
      id: "refresh-ascii-banner-catalog",
      name: "刷新 ascii.rest 图案目录",
      callback: () => this.refreshCatalog(),
    });
  }

  private getActiveMarkdownFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("请先打开一篇 Markdown 笔记");
      return null;
    }
    return file;
  }

  private async configForPath(sourcePath: string): Promise<BannerConfig | null> {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return null;
    return readBannerConfig(this.app.metadataCache.getFileCache(file) ?? undefined, this.knownSlugs);
  }

  private currentConfig(file: TFile): BannerConfig | null {
    const metadata = this.app.metadataCache.getFileCache(file);
    return readBannerConfig(metadata ?? undefined, this.knownSlugs);
  }

  private openBannerPicker(): void {
    const file = this.getActiveMarkdownFile();
    if (!file) return;
    new BannerPickerModal(this.app, this.catalog, this.runtime, async (item, mode) => {
      await writeBannerConfig(this.app, file, catalogItemToConfig(item, mode));
      new Notice(`已设置 ASCII Banner：${item.title}`);
      this.app.workspace.trigger(REFRESH_EVENT);
    }).open();
  }

  private async clearBanner(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) return;
    if (!this.currentConfig(file)) {
      new Notice("当前笔记没有 ASCII Banner");
      return;
    }
    await clearBannerConfig(this.app, file);
    new Notice("已清除 ASCII Banner");
    this.app.workspace.trigger(REFRESH_EVENT);
  }

  private async toggleAnimation(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) return;
    const config = this.currentConfig(file);
    if (!config) {
      new Notice("当前笔记没有 ASCII Banner，请先设置一个图案");
      return;
    }
    const nextMode = config.mode === "animated" ? "still" : "animated";
    await writeBannerConfig(this.app, file, { ...config, mode: nextMode });
    new Notice(nextMode === "animated" ? "已切换为动画模式" : "已切换为静止首帧");
    this.app.workspace.trigger(REFRESH_EVENT);
  }

  private async refreshCatalog(): Promise<void> {
    this.catalog = await refreshRemoteCatalog(
      this.catalog,
      async (url) => {
        const response = await requestUrl(url);
        return { status: response.status, text: response.text };
      },
      () => new Notice("无法连接 ascii.rest，已使用内置图案目录"),
    );
    new Notice(`图案目录已就绪：${this.catalog.length} 个图案`);
  }
}
