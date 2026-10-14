import test from "node:test";
import assert from "node:assert/strict";
import { AsciiRuntime } from "../src/ascii-runtime";
import type { AsciiPiece, BannerConfig } from "../src/types";

class FakeElement {
  children: FakeElement[] = [];
  textContent = "";
  className = "";
  attributes = new Map<string, string>();
  parentElement: FakeElement | null = null;

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  replaceChildren(...children: FakeElement[]) {
    this.children = children;
    for (const child of children) child.parentElement = this;
  }

  appendChild(child: FakeElement) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
}

function config(mode: BannerConfig["mode"] = "animated"): BannerConfig {
  return {
    version: 1,
    piece: "donut",
    source: "https://ascii.rest/donut/",
    mode,
  };
}

function piece(): AsciiPiece {
  return {
    meta: { name: "donut", category: "shapes", note: "turning donut", cols: 2, rows: 1, fps: 30 },
    default: () => () => "o_",
  };
}

test("animated mode passes an fps override and motion option to the ascii runtime", async () => {
  const calls: unknown[] = [];
  const runtime = new AsciiRuntime({
    loadPiece: async () => piece(),
    mountPiece: (_element, _piece, options) => {
      calls.push(options);
      return () => calls.push("disposed");
    },
    createElement: () => new FakeElement() as unknown as HTMLElement,
  });
  const container = new FakeElement() as unknown as HTMLElement;

  const handle = await runtime.mount(container, { ...config(), fps: 12 });

  assert.deepEqual(calls[0], { fps: 12 });
  handle.dispose();
  assert.equal(calls[1], "disposed");
});

test("still mode disables animation", async () => {
  const calls: unknown[] = [];
  const runtime = new AsciiRuntime({
    loadPiece: async () => piece(),
    mountPiece: (_element, _piece, options) => {
      calls.push(options);
      return () => calls.push("disposed");
    },
    createElement: () => new FakeElement() as unknown as HTMLElement,
  });

  await runtime.mount(new FakeElement() as unknown as HTMLElement, config("still"));

  assert.deepEqual(calls[0], { fps: 0, motion: true });
});

test("loader failure falls back to cached frame text without throwing", async () => {
  let shouldFail = false;
  const runtime = new AsciiRuntime({
    loadPiece: async () => {
      if (shouldFail) throw new Error("offline");
      return piece();
    },
    mountPiece: () => () => undefined,
    createElement: (tag) => {
      const element = new FakeElement();
      element.attributes.set("tag", tag);
      return element as unknown as HTMLElement;
    },
  });
  const firstContainer = new FakeElement() as unknown as HTMLElement;
  await runtime.mount(firstContainer, config("still"));
  shouldFail = true;

  const offlineContainer = new FakeElement() as unknown as HTMLElement;
  const handle = await runtime.mount(offlineContainer, config("still"));
  const fallback = (offlineContainer as unknown as FakeElement).children[0];

  assert.equal(fallback.textContent, "o_");
  assert.equal(fallback.className, "ascii-banner-fallback");
  assert.doesNotThrow(() => handle.dispose());
});

test("mounting again on the same container disposes the previous animation", async () => {
  const calls: string[] = [];
  const runtime = new AsciiRuntime({
    loadPiece: async () => piece(),
    mountPiece: () => () => calls.push("disposed"),
    createElement: () => new FakeElement() as unknown as HTMLElement,
  });
  const container = new FakeElement() as unknown as HTMLElement;

  await runtime.mount(container, config());
  await runtime.mount(container, config("still"));

  assert.deepEqual(calls, ["disposed"]);
});

test("shows a readable error hint when loading fails without a cached frame", async () => {
  const runtime = new AsciiRuntime({
    loadPiece: async () => { throw new Error("network down"); },
    mountPiece: () => () => undefined,
    createElement: () => new FakeElement() as unknown as HTMLElement,
  });
  const container = new FakeElement() as unknown as HTMLElement;

  await runtime.mount(container, config());
  const error = (container as unknown as FakeElement).children[0];

  assert.equal(error.className, "ascii-banner-error");
  assert.match(error.textContent, /Donut/);
  assert.match(error.textContent, /network down/);
  assert.equal(error.getAttribute?.("role") ?? error.attributes.get("role"), "img");
});
