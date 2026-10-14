import type { AsciiRuntime } from "./ascii-runtime";
import type { BannerConfig, RuntimeHandle } from "./types";

export interface BannerRuntime {
  mount(container: HTMLElement, config: BannerConfig): Promise<RuntimeHandle>;
  renderStill?(container: HTMLElement, config: BannerConfig): Promise<void>;
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function addClass(element: HTMLElement, className: string): void {
  if (element.classList) {
    element.classList.add(className);
  } else {
    element.className = `${element.className} ${className}`.trim();
  }
}

export function createBannerContainer(config: BannerConfig): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("ASCII Banner needs a document to render");
  }
  const container = document.createElement("div");
  addClass(container, "ascii-banner-container");
  container.setAttribute("data-ascii-piece", config.piece);
  container.setAttribute("role", "img");
  container.setAttribute("aria-label", `${humanizeSlug(config.piece)} ASCII banner`);
  return container;
}

export async function renderBanner(
  container: HTMLElement,
  config: BannerConfig,
  runtime: BannerRuntime | AsciiRuntime,
): Promise<RuntimeHandle> {
  const stage = document.createElement("div");
  addClass(stage, "ascii-banner-stage");
  container.appendChild(stage);

  let runtimeHandle: RuntimeHandle | null = null;
  let disposed = false;
  try {
    runtimeHandle = await runtime.mount(stage, config);
  } catch {
    if (runtime.renderStill) {
      await runtime.renderStill(stage, config);
    }
  }

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      runtimeHandle?.dispose();
      stage.remove();
    },
  };
}
