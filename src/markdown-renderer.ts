import type { MarkdownPostProcessorContext } from "obsidian";
import { createBannerContainer, renderBanner } from "./banner-renderer";
import type { BannerRuntime } from "./banner-renderer";
import type { BannerConfig } from "./types";

export interface MarkdownBannerDeps {
  getConfig(sourcePath: string): Promise<BannerConfig | null>;
  runtime: BannerRuntime;
}

export interface RenderChildLike {
  register(cleanup: () => void): void;
}

export type RenderChildConstructor = new (containerEl: HTMLElement) => RenderChildLike;

export function createMarkdownPostProcessor(
  deps: MarkdownBannerDeps,
  RenderChild: RenderChildConstructor,
): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> {
  return async (el, ctx) => {
    const config = await deps.getConfig(ctx.sourcePath);
    if (!config) return;

    const sizer = el.closest(".markdown-preview-sizer");
    if (!sizer) return;

    const existing = sizer.querySelector(".ascii-banner-container");
    if (existing) {
      if (existing.getAttribute("data-ascii-render") === ctx.docId) return;
      existing.remove();
    }

    const container = createBannerContainer(config);
    container.setAttribute("data-ascii-render", ctx.docId);
    sizer.prepend(container);

    const child = new RenderChild(container);
    ctx.addChild(child as never);
    void renderBanner(container, config, deps.runtime).then((handle) => {
      child.register(() => handle.dispose());
    });
  };
}
