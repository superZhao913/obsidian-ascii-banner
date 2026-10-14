# Obsidian ASCII Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that lets users choose bundled ascii.rest static or animated pieces as per-note banners, persists configuration in YAML frontmatter, and renders it in Reading View and Live Preview.

**Architecture:** Bundle the MIT-licensed `ascii.rest@0.4.0` runtime and official pieces into the plugin. Keep the note format declarative (`ascii-banner` YAML only), use one runtime adapter for both Reading View and CodeMirror Live Preview, and use Obsidian `processFrontMatter` for safe persistence. A generated catalog maps the 236 official slugs to metadata while lazy loading keeps startup work small.

**Tech Stack:** TypeScript, Obsidian API 1.8+, esbuild, `ascii.rest@0.4.0`, Node built-in test runner with `tsx`, CodeMirror 6 APIs supplied by Obsidian.

## Global Constraints

- Never execute scripts, HTML, or arbitrary modules supplied by note frontmatter.
- Only bundled ascii.rest official piece slugs are accepted; arbitrary `src` URLs are rejected.
- Persist only `version`, `piece`, `source`, `mode`, optional `fps`, and JSON-safe `options` under `ascii-banner`.
- `mode` is exactly `animated` or `still`; fps is finite and clamped to 0–120.
- Use `Plugin.registerMarkdownPostProcessor`, `MarkdownRenderChild`, and a CodeMirror 6 `ViewPlugin`; no private Electron APIs.
- Preserve unrelated YAML fields and body text on every frontmatter mutation.
- Keep ascii.rest MIT license text and attribution in `licenses/ascii.rest.MIT.txt` and README.
- Every production behavior added after setup begins with a failing test and a red/green test run.

---

### Task 1: Scaffold the standalone Obsidian plugin

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `manifest.json`
- Create: `.gitignore`
- Create: `src/types.ts`
- Create: `src/catalog.ts`
- Create: `tests/test-helpers.ts`
- Create: `tests/catalog.test.ts`
- Create: `LICENSE`
- Create: `licenses/ascii.rest.MIT.txt`
- Create: `README.md`

**Interfaces:**
- `src/types.ts` exports `BannerMode`, `BannerConfig`, `PieceCatalogItem`, `AsciiPiece`, `RuntimeHandle`.
- `src/catalog.ts` exports `createBundledCatalog()`, `getBundledPiece(slug)`, and `parseRemoteCatalog(html, knownSlugs)`.
- `src/catalog.ts` must import `names`, `load` and `canvas` from `ascii.rest`; `getBundledPiece` returns `Promise<AsciiPiece | undefined>`.

- [ ] **Step 1: Write the failing catalog test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseRemoteCatalog } from "../src/catalog";

test("remote catalog keeps only known ascii.rest piece links", () => {
  const html = `<a href="/kyoto-dusk/">Kyoto Dusk</a><a href="/unknown/">Unknown</a>`;
  assert.deepEqual(parseRemoteCatalog(html, new Set(["kyoto-dusk"])), [
    { slug: "kyoto-dusk", title: "Kyoto Dusk", category: undefined },
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify the expected missing-module failure**

Run: `npm test -- --test-name-pattern="remote catalog keeps"`
Expected: FAIL because the project files and `parseRemoteCatalog` do not exist yet.

- [ ] **Step 3: Add package/build configuration**

`package.json` must contain:

```json
{
  "name": "obsidian-ascii-banner",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "node esbuild.config.mjs production",
    "dev": "node esbuild.config.mjs development",
    "test": "node --import tsx --test tests/**/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "ascii.rest": "0.4.0", "obsidian": "^1.8.7" },
  "devDependencies": { "@types/node": "^22.0.0", "esbuild": "^0.25.0", "tsx": "^4.19.0", "typescript": "^5.7.0" }
}
```

`tsconfig.json` must use `strict: true`, `moduleResolution: "Bundler"`, `target: "ES2020"`, `lib: ["DOM", "ES2020"]`, and exclude `node_modules`, `main.js`, and `tests` from the production project. `manifest.json` must set id `ascii-banner`, name `ASCII Banner`, minAppVersion `1.8.7`, description, author, and version `0.1.0`.

- [ ] **Step 4: Implement catalog types and parser**

Use this behavior in `src/catalog.ts`:

```ts
export type CatalogParser = (html: string, knownSlugs: Set<string>) => PieceCatalogItem[];

export function parseRemoteCatalog(html: string, knownSlugs: Set<string>): PieceCatalogItem[] {
  const result: PieceCatalogItem[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a\b[^>]*href=["']\/([^/"']+?)\/?["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const slug = match[1].toLowerCase();
    if (!knownSlugs.has(slug) || seen.has(slug)) continue;
    const title = match[2].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
    result.push({ slug, title: title || slug, category: undefined });
    seen.add(slug);
  }
  return result;
}
```

`createBundledCatalog()` maps every `names` slug to `{slug, title: slugToTitle(slug), category: undefined, canvas: canvas.has(slug)}`. `getBundledPiece` validates membership before calling `load[slug]()`.

- [ ] **Step 5: Run the focused test and full typecheck**

Run: `npm test -- --test-name-pattern="remote catalog keeps"` and `npm run typecheck`.
Expected: the focused test passes and typecheck succeeds.

- [ ] **Step 6: Add attribution and commit**

Copy the MIT text from the installed `ascii.rest@0.4.0` package into `licenses/ascii.rest.MIT.txt`. `README.md` must identify ascii.rest by bas3line, version 0.4.0, MIT license, and the bundled-runtime rationale. Commit:

```bash
git add package.json package-lock.json tsconfig.json esbuild.config.mjs manifest.json .gitignore src/types.ts src/catalog.ts tests/catalog.test.ts tests/test-helpers.ts LICENSE licenses README.md
git commit -m "chore: scaffold obsidian ascii banner plugin"
```

---

### Task 2: Implement validated frontmatter persistence

**Files:**
- Create: `src/frontmatter.ts`
- Create: `tests/frontmatter.test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- `parseBannerConfig(value: unknown, knownSlugs: Set<string>): BannerConfig | null`
- `bannerConfigKey(config: BannerConfig): string`
- `readBannerConfig(metadata: { frontmatter?: Record<string, unknown> } | undefined, knownSlugs: Set<string>): BannerConfig | null`
- `writeBannerConfig(app: App, file: TFile, config: BannerConfig): Promise<void>`
- `clearBannerConfig(app: App, file: TFile): Promise<void>`

- [ ] **Step 1: Write failing validation tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { bannerConfigKey, parseBannerConfig } from "../src/frontmatter";

test("normalizes a valid animated config", () => {
  const config = parseBannerConfig({
    version: 1, piece: "kyoto-dusk", source: "https://example.invalid", mode: "animated", fps: 15.6, options: { foo: "bar" },
  }, new Set(["kyoto-dusk"]));
  assert.deepEqual(config, {
    version: 1, piece: "kyoto-dusk", source: "https://ascii.rest/kyoto-dusk/", mode: "animated", fps: 15.6, options: { foo: "bar" },
  });
});

test("rejects arbitrary modules, invalid mode, and unsafe options", () => {
  assert.equal(parseBannerConfig({ version: 1, piece: "nope", mode: "animated" }, new Set(["donut"])), null);
  assert.equal(parseBannerConfig({ version: 1, piece: "donut", mode: "loop", options: { html: "<script>" } }, new Set(["donut"])), null);
  assert.equal(parseBannerConfig({ version: 1, piece: "donut", mode: "animated", fps: 121 }, new Set(["donut"])), null);
});

test("key is stable across object key order", () => {
  assert.equal(
    bannerConfigKey({ version: 1, piece: "donut", source: "https://ascii.rest/donut/", mode: "animated", options: { b: 2, a: 1 } }),
    bannerConfigKey({ version: 1, piece: "donut", source: "https://ascii.rest/donut/", mode: "animated", options: { a: 1, b: 2 } }),
  );
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `npm test -- --test-name-pattern="config|key is stable"`
Expected: FAIL because `src/frontmatter.ts` does not exist.

- [ ] **Step 3: Implement validation and deterministic key**

`parseBannerConfig` must reject arrays, non-plain options objects, values deeper than 4 levels, more than 64 keys per object, non-finite numbers, and strings longer than 500 characters. It must clamp `fps` to `[0, 120]`, normalize `source` to `https://ascii.rest/${piece}/`, default missing mode to `animated`, and return `null` for any unknown piece or version other than 1. Implement stable recursive JSON serialization by sorting object keys.

- [ ] **Step 4: Add processFrontMatter persistence**

```ts
export async function writeBannerConfig(app: App, file: TFile, config: BannerConfig): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    frontmatter["ascii-banner"] = {
      version: 1,
      piece: config.piece,
      source: `https://ascii.rest/${config.piece}/`,
      mode: config.mode,
      ...(config.fps === undefined ? {} : { fps: config.fps }),
      ...(config.options && Object.keys(config.options).length ? { options: config.options } : {}),
    };
  });
}

export async function clearBannerConfig(app: App, file: TFile): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    delete frontmatter["ascii-banner"];
  });
}
```

- [ ] **Step 5: Add persistence tests with a real in-memory processFrontMatter stub**

Test that write replaces only `ascii-banner`, clear removes only it, and a second read returns the normalized config. Run `npm test -- tests/frontmatter.test.ts`; expected PASS.

- [ ] **Step 6: Typecheck and commit**

Run `npm run typecheck && npm test`. Commit `feat: persist ascii banner frontmatter`.

---

### Task 3: Implement the shared runtime and fallback rendering

**Files:**
- Create: `src/ascii-runtime.ts`
- Create: `src/banner-renderer.ts`
- Create: `tests/runtime.test.ts`
- Create: `tests/renderer.test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- `AsciiRuntime.mount(container: HTMLElement, config: BannerConfig): Promise<RuntimeHandle>`
- `AsciiRuntime.renderStill(container: HTMLElement, config: BannerConfig): Promise<void>`
- `createBannerContainer(config: BannerConfig): HTMLElement`
- `renderBanner(container: HTMLElement, config: BannerConfig, runtime: AsciiRuntime): Promise<RuntimeHandle>`
- `RuntimeHandle.dispose(): void`

- [ ] **Step 1: Write failing runtime tests**

Use a small fake piece and injected `mount` function. Test that animated mode passes the configured fps and `motion: true`, still mode passes `fps: 0`, cleanup is returned, and a thrown loader falls back to text containing the piece title without throwing.

```ts
test("still mode disables animation", async () => {
  const calls: unknown[] = [];
  const runtime = new AsciiRuntime({
    load: async () => ({ meta: { name: "donut", cols: 2, rows: 1, fps: 30 }, default: () => () => "o_" }),
    mount: (_el, _piece, options) => { calls.push(options); return () => calls.push("disposed"); },
  });
  const container = document.createElement("div");
  const handle = await runtime.mount(container, { version: 1, piece: "donut", source: "https://ascii.rest/donut/", mode: "still" });
  assert.deepEqual(calls[0], { fps: 0, motion: true });
  handle.dispose();
  assert.equal(calls[1], "disposed");
});
```

- [ ] **Step 2: Run test and verify red**

Run: `npm test -- tests/runtime.test.ts`; expected FAIL because runtime classes do not exist.

- [ ] **Step 3: Implement runtime adapter**

Import `mount` from `ascii.rest` and `load` from `ascii.rest` in production. Keep dependencies injectable for tests. Add `renderStill` that uses `meta.still ?? 0`, calls the piece frame with `env`, and writes text into a safe `<pre>`; for palette pieces use a single-color `<pre>` fallback. Catch loading/mounting errors, add `.ascii-banner-error`, and put only text content in the error element.

- [ ] **Step 4: Implement container and renderer**

`createBannerContainer` must create a `div.ascii-banner-container`, set `role="img"` and an accessible `aria-label` from the piece slug, and never assign `innerHTML`. `renderBanner` adds a `.ascii-banner-stage`, calls runtime mount, and returns a cleanup handle; on failure it calls `renderStill` and returns a no-op cleanup.

- [ ] **Step 5: Run runtime/renderer tests and typecheck**

Run `npm test -- tests/runtime.test.ts tests/renderer.test.ts && npm run typecheck`; expected PASS.

- [ ] **Step 6: Commit**

Commit `feat: add ascii banner runtime adapter`.

---

### Task 4: Add Reading View rendering

**Files:**
- Create: `src/markdown-renderer.ts`
- Create: `tests/markdown-renderer.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- `registerMarkdownBanner(plugin: Plugin, deps: MarkdownBannerDeps): void`
- `MarkdownBannerDeps.getConfig(sourcePath: string): Promise<BannerConfig | null>`
- `MarkdownBannerDeps.runtime: AsciiRuntime`

- [ ] **Step 1: Write failing postprocessor test**

Build a fake Markdown postprocessor context with `sourcePath`, `addChild`, and a root element containing a heading. Assert that a valid config inserts exactly one `.ascii-banner-container` before the heading and that a null config leaves the root unchanged.

- [ ] **Step 2: Run the test and verify red**

Run `npm test -- tests/markdown-renderer.test.ts`; expected FAIL because `registerMarkdownBanner` does not exist.

- [ ] **Step 3: Implement postprocessor**

Register a postprocessor that reads config, prepends a banner container, awaits `renderBanner`, and registers a `MarkdownRenderChild` whose `onunload` calls the runtime handle’s `dispose`. Do not add a container if config is null or invalid.

- [ ] **Step 4: Wire Reading View registration in `main.ts`**

On `onload`, register commands/events and call `this.registerMarkdownPostProcessor`. Resolve metadata via `app.metadataCache.getFileCache(file)` and `readBannerConfig`; find the file with `app.vault.getAbstractFileByPath`. On unload, all registered child/event cleanup must be automatic via `register*` methods.

- [ ] **Step 5: Run tests and commit**

Run `npm test && npm run typecheck`. Commit `feat: render ascii banners in reading view`.

---

### Task 5: Add Live Preview widget rendering

**Files:**
- Create: `src/live-preview.ts`
- Create: `tests/live-preview.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- `createLivePreviewExtension(deps: LivePreviewDeps): Extension`
- `LivePreviewDeps.runtime: AsciiRuntime`
- `LivePreviewDeps.knownSlugs: Set<string>`
- `parseBannerFromEditorText(text: string, knownSlugs: Set<string>): BannerConfig | null`

- [ ] **Step 1: Write failing parser/widget tests**

Test parsing frontmatter at document start, no frontmatter, malformed YAML, and a config change that replaces the widget. Assert that the widget is a block decoration at position 0, `ignoreEvent` is true, and no widget exists when config is invalid or absent.

- [ ] **Step 2: Run tests and verify red**

Run `npm test -- tests/live-preview.test.ts`; expected FAIL because the extension does not exist.

- [ ] **Step 3: Implement bounded editor frontmatter parser**

Use Obsidian’s `parseYaml` if available through the dependency, but first isolate only the YAML block delimited by the first `---` pair. Catch parse errors and pass the resulting value through `parseBannerConfig`; never evaluate code or process arbitrary URLs.

- [ ] **Step 4: Implement CodeMirror 6 widget**

Create a `WidgetType` whose `toDOM` calls `createBannerContainer` and starts `renderBanner`; retain the returned cleanup in a `WeakMap`. `eq` compares `bannerConfigKey`. `ignoreEvent()` returns true. A `ViewPlugin` computes a `DecorationSet` with `Decoration.widget({ widget, side: -1, block: true })` at position 0, recreates the widget when `docChanged`, and disposes the prior runtime handle in `destroy`.

- [ ] **Step 5: Register extension in `main.ts`**

Use `registerEditorExtension(createLivePreviewExtension(...))`. Do not touch source text or hide the YAML block; the decoration is visual-only.

- [ ] **Step 6: Run tests and commit**

Run `npm test && npm run typecheck`. Commit `feat: render ascii banners in live preview`.

---

### Task 6: Implement picker modal and commands

**Files:**
- Create: `src/banner-modal.ts`
- Create: `tests/banner-modal.test.ts`
- Modify: `src/main.ts`
- Modify: `src/catalog.ts`

**Interfaces:**
- `BannerPickerModal extends SuggestModal<PieceCatalogItem>`
- constructor `(app: App, catalog: PieceCatalogItem[], runtime: AsciiRuntime, onApply: (item: PieceCatalogItem, mode: BannerMode) => Promise<void>)`
- `refreshRemoteCatalog(): Promise<PieceCatalogItem[]>`

- [ ] **Step 1: Write failing catalog/modal behavior tests**

Test that a catalog refresh failure returns the bundled catalog and invokes the failure callback, and that applying a selected piece passes `mode: "animated"` by default. Avoid asserting Obsidian DOM internals beyond selected item and callback behavior.

- [ ] **Step 2: Run tests and verify red**

Run `npm test -- tests/banner-modal.test.ts`; expected FAIL because the modal does not exist.

- [ ] **Step 3: Implement modal UI**

Use `SuggestModal` for keyboard search and selection; `getSuggestions` filters `slug`, `title`, and `category`; `renderSuggestion` renders text-only metadata and a small preview host; `onChooseSuggestion` invokes `onApply(item, "animated")` and closes. Add buttons/commands for still mode and clearing via commands rather than embedding unsafe HTML.

- [ ] **Step 4: Implement catalog refresh**

Fetch `https://ascii.rest/` with `requestUrl`, parse only known links using `parseRemoteCatalog`, merge metadata with bundled items, and catch all network/HTTP errors. Return bundled catalog on failure and show `Notice("无法连接 ascii.rest，已使用内置图案目录")`.

- [ ] **Step 5: Wire commands**

`main.ts` commands must resolve the active Markdown file, open the modal, call `writeBannerConfig` with the selected slug/title/source/mode, and call `clearBannerConfig` or toggle mode. Trigger `workspace.trigger("ascii-banner:refresh")` after mutation so Reading View and Live Preview refresh; add a registered event listener for that workspace event where needed.

- [ ] **Step 6: Run tests/build and commit**

Run `npm test && npm run typecheck && npm run build`. Commit `feat: add ascii banner picker commands`.

---

### Task 7: Add styling, docs, and release verification

**Files:**
- Create: `styles.css`
- Modify: `esbuild.config.mjs`
- Modify: `README.md`
- Modify: `manifest.json`
- Create: `tests/fixtures/example.md`

- [ ] **Step 1: Add CSS without theme assumptions**

Define `.ascii-banner-container` with `width: 100%`, `overflow: hidden`, `margin: 0 0 1.5rem`, `font-family: var(--font-monospace)`, `line-height: 1.2`, and canvas/pre max-width rules. Use Obsidian variables and `@media (prefers-reduced-motion: reduce)`; add modal grid/list styles only with class selectors.

- [ ] **Step 2: Include CSS in production build**

`esbuild.config.mjs` must copy `styles.css` to the plugin root after a successful build, keep `main.js` external to `obsidian`, and set `platform: "browser"`, `format: "cjs"`, `sourcemap: "inline"` in development and `false` in production.

- [ ] **Step 3: Document installation and data format**

README must include build/install commands, command names, YAML example, dynamic/still behavior, offline fallback, mobile limitations, security boundaries, ascii.rest attribution/license, and manual acceptance checklist.

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test
npm run typecheck
npm run build
cat manifest.json
rg "TODO|TBD|innerHTML|src=|eval\\(" src README.md
```

Expected: all tests pass, typecheck/build succeed, manifest is valid, and the search finds no unsafe runtime patterns or placeholders.

- [ ] **Step 5: Inspect generated bundle and commit**

Confirm `main.js`, `manifest.json`, `styles.css`, and `licenses/ascii.rest.MIT.txt` exist; confirm `main.js` contains no `https://` module import used for execution. Commit `docs: document ascii banner plugin and release checks`.

- [ ] **Step 6: Final clean status**

Run `git status --short --branch` and record the final commit hash. Only after all task evidence is present, report the plugin path and installation instructions.
