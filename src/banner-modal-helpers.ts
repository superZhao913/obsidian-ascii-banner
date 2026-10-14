import { pieceSource } from "./catalog";
import type { BannerConfig, BannerMode, PieceCatalogItem } from "./types";

export function filterCatalog(items: PieceCatalogItem[], query: string): PieceCatalogItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return items;

  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const haystack = [item.slug, item.title, item.category, item.note]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function catalogItemToConfig(item: PieceCatalogItem, mode: BannerMode): BannerConfig {
  return {
    version: 1,
    piece: item.slug,
    source: pieceSource(item.slug),
    mode,
  };
}
