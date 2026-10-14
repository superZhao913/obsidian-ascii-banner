import test from "node:test";
import assert from "node:assert/strict";
import { parseRemoteCatalog } from "../src/catalog";

test("remote catalog keeps only known ascii.rest piece links", () => {
  const html = `<a href="/kyoto-dusk/">Kyoto Dusk</a><a href="/unknown/">Unknown</a>`;
  assert.deepEqual(parseRemoteCatalog(html, new Set(["kyoto-dusk"])), [
    { slug: "kyoto-dusk", title: "Kyoto Dusk", category: undefined },
  ]);
});
