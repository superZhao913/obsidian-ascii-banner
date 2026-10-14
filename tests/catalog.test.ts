import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRemoteCatalog,
  refreshRemoteCatalog,
} from "../src/catalog";

test("remote catalog keeps only known ascii.rest piece links", () => {
  const html = `<a href="/kyoto-dusk/">Kyoto Dusk</a><a href="/unknown/">Unknown</a>`;
  assert.deepEqual(parseRemoteCatalog(html, new Set(["kyoto-dusk"])), [
    { slug: "kyoto-dusk", title: "Kyoto Dusk", category: undefined },
  ]);
});

test("refresh merges known remote titles into the bundled catalog", async () => {
  const bundled = [
    { slug: "kyoto-dusk", title: "Kyoto Dusk", category: undefined },
    { slug: "donut", title: "Donut", category: undefined },
  ];
  const refreshed = await refreshRemoteCatalog(
    bundled,
    async (url) => {
      assert.equal(url, "https://ascii.rest/");
      return { status: 200, text: `<a href="/kyoto-dusk/">Kyoto at Dusk</a>` };
    },
  );
  assert.deepEqual(refreshed, [
    { slug: "kyoto-dusk", title: "Kyoto at Dusk", category: undefined },
    { slug: "donut", title: "Donut", category: undefined },
  ]);
});

test("refresh falls back to bundled catalog and reports a network failure", async () => {
  const bundled = [{ slug: "donut", title: "Donut", category: undefined }];
  const errors: unknown[] = [];
  const refreshed = await refreshRemoteCatalog(
    bundled,
    async () => { throw new Error("offline"); },
    (error) => errors.push(error),
  );
  assert.deepEqual(refreshed, bundled);
  assert.equal(errors.length, 1);
});
