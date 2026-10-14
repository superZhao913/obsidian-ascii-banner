import test from "node:test";
import assert from "node:assert/strict";
import {
  bannerConfigKey,
  clearBannerConfig,
  parseBannerConfig,
  readBannerConfig,
  writeBannerConfig,
} from "../src/frontmatter";

const knownSlugs = new Set(["kyoto-dusk", "donut"]);

function createApp(initial: Record<string, unknown>) {
  const frontmatter = structuredClone(initial) as Record<string, unknown>;
  return {
    frontmatter,
    fileManager: {
      async processFrontMatter(
        _file: unknown,
        callback: (frontmatter: Record<string, unknown>) => void,
      ) {
        callback(frontmatter);
      },
    },
  };
}

test("normalizes a valid animated config and canonical source", () => {
  const config = parseBannerConfig(
    {
      version: 1,
      piece: "kyoto-dusk",
      source: "https://example.invalid/anything",
      mode: "animated",
      fps: 15.6,
      options: { foo: "bar" },
    },
    knownSlugs,
  );

  assert.deepEqual(config, {
    version: 1,
    piece: "kyoto-dusk",
    source: "https://ascii.rest/kyoto-dusk/",
    mode: "animated",
    fps: 15.6,
    options: { foo: "bar" },
  });
});

test("rejects unknown pieces, invalid modes, out-of-range fps, and unsafe options", () => {
  assert.equal(
    parseBannerConfig({ version: 1, piece: "nope", mode: "animated" }, knownSlugs),
    null,
  );
  assert.equal(
    parseBannerConfig(
      { version: 1, piece: "donut", mode: "loop", options: {} },
      knownSlugs,
    ),
    null,
  );
  assert.equal(
    parseBannerConfig({ version: 1, piece: "donut", mode: "animated", fps: 121 }, knownSlugs)?.fps,
    120,
  );
  assert.equal(
    parseBannerConfig(
      { version: 1, piece: "donut", mode: "animated", options: { html: "<script>alert(1)</script>" } },
      knownSlugs,
    ),
    null,
  );
});

test("uses animated mode by default and keeps still mode", () => {
  assert.equal(
    parseBannerConfig({ version: 1, piece: "donut" }, knownSlugs)?.mode,
    "animated",
  );
  assert.equal(
    parseBannerConfig({ version: 1, piece: "donut", mode: "still" }, knownSlugs)?.mode,
    "still",
  );
});

test("stable key is independent of option object key order", () => {
  const first = {
    version: 1 as const,
    piece: "donut",
    source: "https://ascii.rest/donut/",
    mode: "animated" as const,
    options: { b: 2, a: 1 },
  };
  const second = {
    ...first,
    options: { a: 1, b: 2 },
  };
  assert.equal(bannerConfigKey(first), bannerConfigKey(second));
});

test("reads, replaces, and clears only the ascii-banner frontmatter field", async () => {
  const app = createApp({ title: "Keep me", tags: ["notes"], "ascii-banner": { piece: "old" } });
  const file = { path: "note.md" };
  const config = {
    version: 1 as const,
    piece: "donut",
    source: "https://ascii.rest/donut/",
    mode: "still" as const,
    fps: 0,
    options: { text: "hello" },
  };

  await writeBannerConfig(app as never, file as never, config);
  assert.deepEqual(app.frontmatter, {
    title: "Keep me",
    tags: ["notes"],
    "ascii-banner": {
      version: 1,
      piece: "donut",
      source: "https://ascii.rest/donut/",
      mode: "still",
      fps: 0,
      options: { text: "hello" },
    },
  });
  assert.deepEqual(
    readBannerConfig({ frontmatter: app.frontmatter }, knownSlugs),
    config,
  );

  await clearBannerConfig(app as never, file as never);
  assert.deepEqual(app.frontmatter, { title: "Keep me", tags: ["notes"] });
});
