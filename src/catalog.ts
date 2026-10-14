import { canvas, load, names } from "ascii.rest";
import type { PieceCatalogItem, AsciiPiece } from "./types";

const ASCII_REST_ORIGIN = "https://ascii.rest";

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

export function pieceSource(slug: string): string {
  return `${ASCII_REST_ORIGIN}/${encodeURIComponent(slug)}/`;
}

export function parseRemoteCatalog(html: string, knownSlugs: Set<string>): PieceCatalogItem[] {
  const result: PieceCatalogItem[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a\b[^>]*href=["']\/([^/"']+?)\/?["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const slug = match[1].toLowerCase();
    if (!knownSlugs.has(slug) || seen.has(slug)) continue;
    const title = decodeHtml(match[2]);
    result.push({ slug, title: title || slug, category: undefined });
    seen.add(slug);
  }

  return result;
}

export function createBundledCatalog(): PieceCatalogItem[] {
  return names.map((slug) => ({
    slug,
    title: slugToTitle(slug),
    canvas: canvas.has(slug),
  }));
}

export function isBundledPiece(slug: string): boolean {
  return typeof slug === "string" && Object.prototype.hasOwnProperty.call(load, slug);
}

export async function getBundledPiece(slug: string): Promise<AsciiPiece | undefined> {
  if (!isBundledPiece(slug)) return undefined;
  const loader = load[slug as keyof typeof load];
  return (await loader()) as AsciiPiece;
}

export async function getBundledPieceMetadata(slug: string): Promise<PieceCatalogItem | undefined> {
  const piece = await getBundledPiece(slug);
  if (!piece) return undefined;
  return {
    slug,
    title: piece.meta.name,
    category: piece.meta.category,
    note: piece.meta.note,
    fps: piece.meta.fps,
    canvas: Boolean(piece.meta.palette),
    meta: piece.meta,
  };
}

export function mergeRemoteCatalog(
  bundled: PieceCatalogItem[],
  remote: PieceCatalogItem[],
): PieceCatalogItem[] {
  const bySlug = new Map(bundled.map((item) => [item.slug, item]));
  for (const item of remote) {
    const existing = bySlug.get(item.slug);
    if (existing) bySlug.set(item.slug, { ...existing, ...item });
  }
  return bundled.map((item) => bySlug.get(item.slug) ?? item);
}

export interface CatalogResponse {
  status: number;
  text: string;
}

export type CatalogRequest = (url: string) => Promise<CatalogResponse>;

export async function refreshRemoteCatalog(
  bundled: PieceCatalogItem[],
  request: CatalogRequest,
  onError?: (error: unknown) => void,
): Promise<PieceCatalogItem[]> {
  try {
    const response = await request(`${ASCII_REST_ORIGIN}/`);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`ascii.rest returned HTTP ${response.status}`);
    }
    const remote = parseRemoteCatalog(response.text, new Set(bundled.map((item) => item.slug)));
    return mergeRemoteCatalog(bundled, remote);
  } catch (error) {
    onError?.(error);
    return bundled;
  }
}

export const ASCII_REST_URL = ASCII_REST_ORIGIN;
