import test from "node:test";
import assert from "node:assert/strict";
import { parseBannerFromEditorText } from "../src/live-preview-parse";

const knownSlugs = new Set(["kyoto-dusk", "donut"]);

test("parses a banner config from leading YAML frontmatter", () => {
  const text = [
    "---",
    "title: Demo",
    "ascii-banner:",
    "  version: 1",
    "  piece: kyoto-dusk",
    "  source: https://ascii.rest/kyoto-dusk/",
    "  mode: still",
    "  fps: 15",
    "---",
    "",
    "# Hello",
  ].join("\n");

  const config = parseBannerFromEditorText(text, knownSlugs);
  assert.deepEqual(config, {
    version: 1,
    piece: "kyoto-dusk",
    source: "https://ascii.rest/kyoto-dusk/",
    mode: "still",
    fps: 15,
  });
});

test("supports inline JSON options written by the plugin", () => {
  const text = [
    "---",
    "ascii-banner:",
    "  version: 1",
    "  piece: donut",
    "  options: {\"text\":\"hello\"}",
    "---",
    "body",
  ].join("\n");
  const config = parseBannerFromEditorText(text, knownSlugs);
  assert.deepEqual(config?.options, { text: "hello" });
});

test("tolerates quoted scalars", () => {
  const text = [
    "---",
    "ascii-banner:",
    '  version: "1"',
    '  piece: "donut"',
    '  mode: "animated"',
    "---",
  ].join("\n");
  const config = parseBannerFromEditorText(text, knownSlugs);
  assert.equal(config?.piece, "donut");
  assert.equal(config?.mode, "animated");
});

test("returns null without frontmatter or without a banner block", () => {
  assert.equal(parseBannerFromEditorText("# Just a heading", knownSlugs), null);
  assert.equal(
    parseBannerFromEditorText(["---", "title: Demo", "---", "body"].join("\n"), knownSlugs),
    null,
  );
});

test("returns null for malformed or unsafe banner blocks without throwing", () => {
  assert.equal(
    parseBannerFromEditorText(["---", "ascii-banner:", "  piece: donut", "  mode: warp", "---"].join("\n"), knownSlugs),
    null,
  );
  assert.equal(
    parseBannerFromEditorText(["---", "ascii-banner:", "  piece: unknown-piece", "---"].join("\n"), knownSlugs),
    null,
  );
  assert.equal(
    parseBannerFromEditorText(["---", "ascii-banner: [broken"].join("\n"), knownSlugs),
    null,
  );
  assert.equal(
    parseBannerFromEditorText(["---", "ascii-banner:", "  options: {", "---"].join("\n"), knownSlugs),
    null,
  );
});

test("ignores banner blocks that are not in the leading frontmatter", () => {
  const text = [
    "# Heading",
    "---",
    "ascii-banner:",
    "  piece: donut",
    "---",
  ].join("\n");
  assert.equal(parseBannerFromEditorText(text, knownSlugs), null);
});
