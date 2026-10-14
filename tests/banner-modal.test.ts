import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogItemToConfig,
  filterCatalog,
} from "../src/banner-modal-helpers";

const catalog = [
  { slug: "kyoto-dusk", title: "Kyoto Dusk", category: "scenes", note: "A pagoda at dusk" },
  { slug: "donut", title: "Donut", category: "shapes", note: "A turning torus" },
  { slug: "matrix-rain", title: "Matrix Rain", category: "effects", note: "Falling code" },
];

test("filters catalog by title, slug, category, and note", () => {
  assert.deepEqual(filterCatalog(catalog, "SCENES"), [catalog[0]]);
  assert.deepEqual(filterCatalog(catalog, "matrix"), [catalog[2]]);
  assert.deepEqual(filterCatalog(catalog, "torus"), [catalog[1]]);
  assert.deepEqual(filterCatalog(catalog, ""), catalog);
});

test("converts a selected catalog item into a persisted banner config", () => {
  assert.deepEqual(catalogItemToConfig(catalog[0], "animated"), {
    version: 1,
    piece: "kyoto-dusk",
    source: "https://ascii.rest/kyoto-dusk/",
    mode: "animated",
  });
  assert.equal(catalogItemToConfig(catalog[1], "still").mode, "still");
});
