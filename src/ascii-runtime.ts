import { load as bundledLoad, mount as bundledMount } from "ascii.rest";
import type { MountOptions } from "ascii.rest";
import type { AsciiPiece, BannerConfig, RuntimeHandle } from "./types";

export interface AsciiRuntimeDependencies {
  loadPiece?: (slug: string) => Promise<AsciiPiece>;
  mountPiece?: (
    element: HTMLElement,
    piece: AsciiPiece,
    options: MountOptions,
  ) => () => void;
  createElement?: (tag: "pre" | "canvas") => HTMLElement;
}

const NOOP_HANDLE: RuntimeHandle = { dispose: () => undefined };

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

type StableJson = null | boolean | number | string | StableJson[] | { [key: string]: StableJson };

function stableValue(value: unknown): StableJson {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: { [key: string]: StableJson } = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      result[key] = stableValue(source[key]);
    }
    return result;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  throw new TypeError("ASCII Banner options contain a non-JSON value");
}

function optionsKey(config: BannerConfig): string {
  return JSON.stringify(stableValue({ piece: config.piece, options: config.options ?? {} }));
}

function addClass(element: HTMLElement, className: string): void {
  if (element.classList) {
    element.classList.add(className);
    return;
  }
  element.className = `${element.className} ${className}`.trim();
}

function setAccessibleLabel(element: HTMLElement, config: BannerConfig): void {
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", `${humanizeSlug(config.piece)} ASCII banner`);
}

export class AsciiRuntime {
  private readonly loadPiece: (slug: string) => Promise<AsciiPiece>;
  private readonly mountPiece: (
    element: HTMLElement,
    piece: AsciiPiece,
    options: MountOptions,
  ) => () => void;
  private readonly createElement: (tag: "pre" | "canvas") => HTMLElement;
  private readonly frameCache = new Map<string, string>();
  private readonly activeHandles = new WeakMap<HTMLElement, RuntimeHandle>();

  constructor(dependencies: AsciiRuntimeDependencies = {}) {
    this.loadPiece = dependencies.loadPiece ?? (async (slug) => {
      const loader = bundledLoad[slug as keyof typeof bundledLoad];
      if (!loader) throw new Error(`Unknown ascii.rest piece: ${slug}`);
      return (await loader()) as AsciiPiece;
    });
    this.mountPiece = dependencies.mountPiece ?? ((element, piece, options) =>
      bundledMount(element, piece, options));
    this.createElement = dependencies.createElement ?? ((tag) => {
      if (typeof document === "undefined") {
        throw new Error("ASCII Banner needs a document to render");
      }
      return document.createElement(tag);
    });
  }

  async mount(container: HTMLElement, config: BannerConfig): Promise<RuntimeHandle> {
    this.activeHandles.get(container)?.dispose();
    try {
      const piece = await this.loadPiece(config.piece);
      const options = this.getMountOptions(config);
      const fallbackFrame = this.makeFrame(piece, options);
      if (fallbackFrame !== null) this.frameCache.set(optionsKey(config), fallbackFrame);

      const element = this.createElement(piece.meta.palette ? "canvas" : "pre");
      addClass(element, piece.meta.palette ? "ascii-banner-canvas" : "ascii-banner-text");
      setAccessibleLabel(element, config);
      container.replaceChildren(element);
      const disposeMount = this.mountPiece(element, piece, options);
      const handle: RuntimeHandle = {
        dispose: () => {
          disposeMount?.();
          if (this.activeHandles.get(container) === handle) this.activeHandles.delete(container);
        },
      };
      this.activeHandles.set(container, handle);
      return handle;
    } catch (error) {
      this.renderCachedFallback(container, config, error);
      return NOOP_HANDLE;
    }
  }

  async renderStill(container: HTMLElement, config: BannerConfig): Promise<void> {
    try {
      const piece = await this.loadPiece(config.piece);
      const options = this.getMountOptions({ ...config, mode: "still" });
      const frame = this.makeFrame(piece, options);
      if (frame !== null) {
        this.frameCache.set(optionsKey(config), frame);
        this.renderStaticText(container, config, frame);
      } else {
        this.renderCachedFallback(container, config);
      }
    } catch (error) {
      this.renderCachedFallback(container, config, error);
    }
  }

  private getMountOptions(config: BannerConfig): MountOptions {
    const options: MountOptions = { ...(config.options ?? {}) };
    if (config.mode === "still") {
      options.fps = 0;
      options.motion = true;
    } else if (config.fps !== undefined) {
      options.fps = config.fps;
    }
    return options;
  }

  private makeFrame(piece: AsciiPiece, options: MountOptions): string | null {
    try {
      const frame = piece.default(options);
      const env: { color?: Uint8Array } = {};
      if (piece.meta.palette) env.color = new Uint8Array(piece.meta.cols * piece.meta.rows);
      return frame(piece.meta.still ?? 0, env);
    } catch {
      return null;
    }
  }

  private renderStaticText(container: HTMLElement, config: BannerConfig, text: string): void {
    const element = this.createElement("pre");
    addClass(element, "ascii-banner-fallback");
    setAccessibleLabel(element, config);
    element.textContent = text;
    container.replaceChildren(element);
  }

  private renderCachedFallback(container: HTMLElement, config: BannerConfig, error?: unknown): void {
    const cached = this.frameCache.get(optionsKey(config));
    if (cached !== undefined) {
      this.renderStaticText(container, config, cached);
      return;
    }
    const element = this.createElement("pre");
    addClass(element, "ascii-banner-error");
    setAccessibleLabel(element, config);
    const reason = error instanceof Error ? error.message : "暂时无法加载";
    element.textContent = `${humanizeSlug(config.piece)}\n[ASCII Banner: ${reason}]`;
    container.replaceChildren(element);
  }
}
