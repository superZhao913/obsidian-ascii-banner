import { Modal } from "obsidian";
import { createBannerContainer, renderBanner } from "./banner-renderer";
import { createBundledCatalog } from "./catalog";
import { catalogItemToConfig, filterCatalog } from "./banner-modal-helpers";
import type { AsciiRuntime } from "./ascii-runtime";
import type { BannerMode, PieceCatalogItem, RuntimeHandle } from "./types";

export interface BannerPickerModalOptions {
  initialMode?: BannerMode;
}

export type BannerApplyCallback = (item: PieceCatalogItem, mode: BannerMode) => Promise<void> | void;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (className) result.classList.add(className);
  return result;
}

function setText(target: HTMLElement, text: string): void {
  target.textContent = text;
}

export class BannerPickerModal extends Modal {
  private readonly catalog: PieceCatalogItem[];
  private readonly runtime: AsciiRuntime;
  private readonly onApply: BannerApplyCallback;
  private readonly initialMode: BannerMode;
  private selected: PieceCatalogItem | null = null;
  private mode: BannerMode;
  private previewHandle: RuntimeHandle | null = null;
  private previewContainer: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private previewEl: HTMLElement | null = null;
  private detailsEl: HTMLElement | null = null;
  private query = "";

  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    catalog: PieceCatalogItem[] = createBundledCatalog(),
    runtime: AsciiRuntime,
    onApply: BannerApplyCallback,
    options: BannerPickerModalOptions = {},
  ) {
    super(app);
    this.catalog = [...catalog];
    this.runtime = runtime;
    this.onApply = onApply;
    this.initialMode = options.initialMode ?? "animated";
    this.mode = this.initialMode;
  }

  override onOpen(): void {
    this.setTitle("选择 ASCII Banner");
    this.modalEl.classList.add("ascii-banner-modal");
    this.contentEl.replaceChildren();

    const root = element("div", "ascii-banner-picker");
    const search = element("input", "ascii-banner-search");
    search.type = "search";
    search.placeholder = "搜索名称、分类或描述…";
    search.setAttribute("aria-label", "搜索 ASCII 图案");
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderList();
    });

    const layout = element("div", "ascii-banner-picker-layout");
    this.listEl = element("div", "ascii-banner-picker-list");
    this.listEl.setAttribute("role", "listbox");
    this.previewEl = element("div", "ascii-banner-picker-preview");
    this.previewEl.setAttribute("aria-live", "polite");
    this.detailsEl = element("div", "ascii-banner-picker-details");

    const modeRow = element("div", "ascii-banner-picker-mode");
    const modeLabel = element("span");
    setText(modeLabel, "显示方式");
    const animatedButton = this.createModeButton("动画", "animated");
    const stillButton = this.createModeButton("静止首帧", "still");
    modeRow.append(modeLabel, animatedButton, stillButton);

    const footer = element("div", "ascii-banner-picker-footer");
    const cancelButton = element("button");
    cancelButton.type = "button";
    setText(cancelButton, "取消");
    cancelButton.addEventListener("click", () => this.close());
    const applyButton = element("button", "mod-cta");
    applyButton.type = "button";
    setText(applyButton, "应用到当前笔记");
    applyButton.addEventListener("click", () => {
      if (!this.selected) return;
      void Promise.resolve(this.onApply(this.selected, this.mode)).then(() => this.close());
    });
    footer.append(cancelButton, applyButton);

    layout.append(this.listEl, this.previewEl);
    root.append(search, layout, this.detailsEl, modeRow, footer);
    this.contentEl.append(root);
    this.renderList();
  }

  override onClose(): void {
    this.previewHandle?.dispose();
    this.previewHandle = null;
    this.previewContainer = null;
    this.selected = null;
    this.listEl = null;
    this.previewEl = null;
    this.detailsEl = null;
    this.contentEl.replaceChildren();
  }

  private createModeButton(label: string, mode: BannerMode): HTMLButtonElement {
    const button = element("button");
    button.type = "button";
    setText(button, label);
    button.dataset.mode = mode;
    button.addEventListener("click", () => {
      this.mode = mode;
      this.updateModeButtons();
      if (this.selected) void this.renderPreview(this.selected);
    });
    button.classList.toggle("is-active", this.mode === mode);
    return button;
  }

  private updateModeButtons(): void {
    const buttons = this.contentEl.querySelectorAll<HTMLButtonElement>("button[data-mode]");
    buttons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === this.mode));
  }

  private renderList(): void {
    if (!this.listEl) return;
    const items = filterCatalog(this.catalog, this.query);
    this.listEl.replaceChildren();
    if (items.length === 0) {
      const empty = element("p", "ascii-banner-picker-empty");
      setText(empty, "没有匹配的图案");
      this.listEl.append(empty);
      return;
    }

    for (const item of items) {
      const button = element("button", "ascii-banner-picker-item");
      button.type = "button";
      button.dataset.slug = item.slug;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(this.selected?.slug === item.slug));
      const title = element("strong");
      setText(title, item.title);
      const meta = element("small");
      setText(meta, [item.category, item.note].filter(Boolean).join(" · ") || item.slug);
      button.append(title, meta);
      button.addEventListener("click", () => {
        this.selected = item;
        this.renderList();
        void this.renderPreview(item);
      });
      this.listEl.append(button);
    }

    if (!this.selected || !items.some((item) => item.slug === this.selected?.slug)) {
      this.selected = items[0];
      void this.renderPreview(items[0]);
    }
  }

  private async renderPreview(item: PieceCatalogItem): Promise<void> {
    if (!this.previewEl) return;
    this.previewHandle?.dispose();
    this.previewHandle = null;
    this.previewEl.replaceChildren();

    const config = catalogItemToConfig(item, this.mode);
    const container = createBannerContainer(config);
    this.previewContainer = container;
    this.previewEl.append(container);
    this.previewHandle = await renderBanner(container, config, this.runtime);

    if (this.detailsEl) {
      const details = [item.title, item.category, item.note].filter(Boolean).join(" · ");
      setText(this.detailsEl, details || item.slug);
    }
    this.updateModeButtons();
  }
}
