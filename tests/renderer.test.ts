import test from "node:test";
import assert from "node:assert/strict";
import { createBannerContainer, renderBanner } from "../src/banner-renderer";
import type { BannerConfig, RuntimeHandle } from "../src/types";

class FakeElement {
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = "";
  textContent = "";
  attributes = new Map<string, string>();
  classList = {
    add: (name: string) => {
      this.className = `${this.className} ${name}`.trim();
    },
  };

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: FakeElement) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  replaceChildren(...children: FakeElement[]) {
    this.children = children;
    for (const child of children) child.parentElement = this;
  }

  remove() {
    this.parentElement?.replaceChildren(
      ...this.parentElement.children.filter((child) => child !== this),
    );
    this.parentElement = null;
  }
}

function installFakeDocument() {
  const original = (globalThis as { document?: unknown }).document;
  const fakeDocument = {
    createElement: () => new FakeElement(),
  };
  (globalThis as { document?: unknown }).document = fakeDocument;
  return () => {
    (globalThis as { document?: unknown }).document = original;
  };
}

function config(): BannerConfig {
  return {
    version: 1,
    piece: "kyoto-dusk",
    source: "https://ascii.rest/kyoto-dusk/",
    mode: "animated",
  };
}

test("creates an accessible banner container without HTML interpolation", () => {
  const restore = installFakeDocument();
  try {
    const container = createBannerContainer(config()) as unknown as FakeElement;
    assert.equal(container.className, "ascii-banner-container");
    assert.equal(container.getAttribute("data-ascii-piece"), "kyoto-dusk");
    assert.equal(container.getAttribute("role"), "img");
    assert.equal(container.getAttribute("aria-label"), "Kyoto Dusk ASCII banner");
    assert.equal(container.textContent, "");
  } finally {
    restore();
  }
});

test("mounts into a stage and disposes the runtime handle", async () => {
  const restore = installFakeDocument();
  try {
    const calls: string[] = [];
    const runtime = {
      mount: async (stage: HTMLElement, received: BannerConfig): Promise<RuntimeHandle> => {
        assert.equal((stage as unknown as FakeElement).className, "ascii-banner-stage");
        assert.equal(received.piece, "kyoto-dusk");
        calls.push("mounted");
        return { dispose: () => calls.push("disposed") };
      },
    };
    const container = createBannerContainer(config());
    const handle = await renderBanner(container, config(), runtime as never);
    assert.equal(calls[0], "mounted");
    assert.equal((container as unknown as FakeElement).children.length, 1);
    handle.dispose();
    assert.deepEqual(calls, ["mounted", "disposed"]);
    assert.equal((container as unknown as FakeElement).children.length, 0);
  } finally {
    restore();
  }
});
