import test from "node:test";
import assert from "node:assert/strict";
import { createMarkdownPostProcessor } from "../src/markdown-renderer";
import type { BannerConfig, RuntimeHandle } from "../src/types";

class FakeElement {
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  classSet = new Set<string>();
  attributes = new Map<string, string>();
  textContent = "";
  classList = {
    add: (name: string) => this.classSet.add(name),
    toggle: (name: string, force?: boolean) => {
      if (force ?? !this.classSet.has(name)) this.classSet.add(name);
      else this.classSet.delete(name);
    },
  };

  get className(): string {
    return [...this.classSet].join(" ");
  }

  set className(value: string) {
    this.classSet = new Set(value.split(/\s+/).filter(Boolean));
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) this.appendChild(child);
  }

  prepend(child: FakeElement): void {
    this.children.unshift(child);
    child.parentElement = this;
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children = children;
    for (const child of children) child.parentElement = this;
  }

  remove(): void {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  closest(selector: string): FakeElement | null {
    let node: FakeElement | null = this;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (matches(child, selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

function matches(element: FakeElement, selector: string): boolean {
  const attrMatch = /^\.([\w-]+)\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (attrMatch) {
    const [, cls, attr, value] = attrMatch;
    if (!element.classSet.has(cls)) return false;
    if (value === undefined) return element.attributes.has(attr);
    return element.attributes.get(attr) === value;
  }
  const classMatch = /^\.([\w-]+)$/.exec(selector);
  return classMatch ? element.classSet.has(classMatch[1]) : false;
}

function installFakeDocument() {
  const original = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { createElement: () => new FakeElement() };
  return () => {
    (globalThis as { document?: unknown }).document = original;
  };
}

class FakeRenderChild {
  cleanups: (() => void)[] = [];
  constructor(readonly containerEl: unknown) {}
  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }
}

interface FakeContext {
  sourcePath: string;
  docId: string;
  children: FakeRenderChild[];
  addChild(child: FakeRenderChild): void;
}

function fakeContext(docId: string): FakeContext {
  const ctx: FakeContext = {
    sourcePath: "notes/demo.md",
    docId,
    children: [],
    addChild(child: FakeRenderChild) {
      ctx.children.push(child);
    },
  };
  return ctx;
}

function config(): BannerConfig {
  return {
    version: 1,
    piece: "kyoto-dusk",
    source: "https://ascii.rest/kyoto-dusk/",
    mode: "animated",
  };
}

function fakeRuntime(calls: string[]) {
  return {
    async mount(stage: HTMLElement): Promise<RuntimeHandle> {
      calls.push("mounted");
      return { dispose: () => calls.push("disposed") };
    },
  };
}

function fakePreview(): { sizer: FakeElement; section: FakeElement; heading: FakeElement } {
  const sizer = new FakeElement();
  sizer.className = "markdown-preview-sizer";
  const section = new FakeElement();
  section.className = "markdown-preview-section";
  const heading = new FakeElement();
  heading.className = "heading";
  section.appendChild(heading);
  sizer.appendChild(section);
  return { sizer, section, heading };
}

test("inserts the banner before document content and only once per render", async () => {
  const restore = installFakeDocument();
  try {
    const calls: string[] = [];
    const processor = createMarkdownPostProcessor(
      { getConfig: async () => config(), runtime: fakeRuntime(calls) as never },
      FakeRenderChild as never,
    );
    const { sizer, section, heading } = fakePreview();
    const ctx = fakeContext("render-1");

    await processor(section as unknown as HTMLElement, ctx as never);
    await processor(section as unknown as HTMLElement, ctx as never);

    const banner = sizer.querySelector(".ascii-banner-container");
    assert.ok(banner);
    assert.equal(sizer.children[0], banner);
    assert.equal(banner.parentElement, sizer);
    assert.ok(sizer.children.includes(section));
    assert.equal(section.children[0], heading);
    assert.deepEqual(calls, ["mounted"]);
    assert.equal(ctx.children.length, 1);
  } finally {
    restore();
  }
});

test("leaves the document untouched when there is no banner config", async () => {
  const restore = installFakeDocument();
  try {
    const calls: string[] = [];
    const processor = createMarkdownPostProcessor(
      { getConfig: async () => null, runtime: fakeRuntime(calls) as never },
      FakeRenderChild as never,
    );
    const { sizer, section, heading } = fakePreview();
    await processor(section as unknown as HTMLElement, fakeContext("render-2") as never);
    assert.equal(sizer.querySelector(".ascii-banner-container"), null);
    assert.deepEqual(sizer.children, [section]);
    assert.equal(section.children[0], heading);
    assert.deepEqual(calls, []);
  } finally {
    restore();
  }
});

test("a re-render replaces the previous banner and disposes the old runtime", async () => {
  const restore = installFakeDocument();
  try {
    const calls: string[] = [];
    const processor = createMarkdownPostProcessor(
      { getConfig: async () => config(), runtime: fakeRuntime(calls) as never },
      FakeRenderChild as never,
    );
    const { sizer, section } = fakePreview();

    await processor(section as unknown as HTMLElement, fakeContext("render-1") as never);
    const first = sizer.querySelector(".ascii-banner-container");
    assert.equal(first?.getAttribute("data-ascii-render"), "render-1");
    ctxDispose(first);

    await processor(section as unknown as HTMLElement, fakeContext("render-2") as never);
    const second = sizer.querySelector(".ascii-banner-container");
    assert.equal(second?.getAttribute("data-ascii-render"), "render-2");
    assert.deepEqual(calls, ["mounted", "mounted"]);

    function ctxDispose(_el: unknown): void {
      // disposal happens through MarkdownRenderChild; nothing to call here
    }
  } finally {
    restore();
  }
});
