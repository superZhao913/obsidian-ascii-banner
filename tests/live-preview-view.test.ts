import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createLivePreviewExtension } from "../src/live-preview";
import type { BannerConfig, RuntimeHandle } from "../src/types";

function setupDom() {
  const dom = new JSDOM("<!DOCTYPE html><body></body>", { pretendToBeVisual: true });
  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    MutationObserver: dom.window.MutationObserver,
    ResizeObserver: dom.window.ResizeObserver,
    IntersectionObserver: dom.window.IntersectionObserver,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  };
  const originals = new Map<string, unknown>();
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, (globalThis as Record<string, unknown>)[key]);
    (globalThis as Record<string, unknown>)[key] = value;
  }
  return () => {
    for (const [key, value] of originals) {
      (globalThis as Record<string, unknown>)[key] = value;
    }
  };
}

const BANNER_DOC = [
  "---",
  "ascii-banner:",
  "  version: 1",
  "  piece: kyoto-dusk",
  "  source: https://ascii.rest/kyoto-dusk/",
  "  mode: animated",
  "---",
  "",
  "# 崩溃测试",
  "",
].join("\n");

const PLAIN_DOC = "# Plain note\n\nbody\n";

function fakeRuntime() {
  return {
    async mount(container: HTMLElement, _config: BannerConfig): Promise<RuntimeHandle> {
      container.textContent = "fake banner";
      return { dispose: () => undefined };
    },
    async renderStill(): Promise<void> {},
  };
}

test("live preview extension does not break the editor for a banner document", () => {
  const restore = setupDom();
  try {
    const state = EditorState.create({
      doc: BANNER_DOC,
      extensions: [createLivePreviewExtension({ runtime: fakeRuntime() as never, knownSlugs: new Set(["kyoto-dusk"]) })],
    });
    const view = new EditorView({ state, parent: document.body as unknown as HTMLElement });
    const banner = document.querySelector(".ascii-banner-container");
    assert.ok(banner, "banner widget should be mounted at the top of the editor");
    assert.ok(view.dom.isConnected);
    view.destroy();
  } finally {
    restore();
  }
});

test("live preview extension leaves plain documents untouched", () => {
  const restore = setupDom();
  try {
    const state = EditorState.create({
      doc: PLAIN_DOC,
      extensions: [createLivePreviewExtension({ runtime: fakeRuntime() as never, knownSlugs: new Set(["kyoto-dusk"]) })],
    });
    const view = new EditorView({ state, parent: document.body as unknown as HTMLElement });
    assert.equal(document.querySelector(".ascii-banner-container"), null);
    view.destroy();
  } finally {
    restore();
  }
});
