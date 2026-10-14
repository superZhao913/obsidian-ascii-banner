import type { App, CachedMetadata, TFile } from "obsidian";
import type { BannerConfig, BannerMode } from "./types";

const MAX_STRING_LENGTH = 500;
const MAX_OBJECT_KEYS = 64;
const MAX_DEPTH = 4;
const SOURCE_PREFIX = "https://ascii.rest/";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function containsUnsafeString(value: string): boolean {
  return /<\/?(?:script|iframe|object|embed|style|html)\b|javascript\s*:|data\s*:/i.test(value);
}

function sanitizeOptions(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!isPlainObject(value) || depth > MAX_DEPTH || Object.keys(value).length > MAX_OBJECT_KEYS) {
    return null;
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key.length > MAX_STRING_LENGTH || containsUnsafeString(key)) return null;
    if (typeof child === "string") {
      if (child.length > MAX_STRING_LENGTH || containsUnsafeString(child)) return null;
      result[key] = child;
      continue;
    }
    if (typeof child === "number") {
      if (!Number.isFinite(child)) return null;
      result[key] = child;
      continue;
    }
    if (typeof child === "boolean" || child === null) {
      result[key] = child;
      continue;
    }
    if (Array.isArray(child)) {
      if (child.length > MAX_OBJECT_KEYS) return null;
      const sanitizedArray: unknown[] = [];
      for (const entry of child) {
        if (typeof entry === "string") {
          if (entry.length > MAX_STRING_LENGTH || containsUnsafeString(entry)) return null;
          sanitizedArray.push(entry);
        } else if (typeof entry === "number") {
          if (!Number.isFinite(entry)) return null;
          sanitizedArray.push(entry);
        } else if (typeof entry === "boolean" || entry === null) {
          sanitizedArray.push(entry);
        } else if (isPlainObject(entry)) {
          const nested = sanitizeOptions(entry, depth + 1);
          if (!nested) return null;
          sanitizedArray.push(nested);
        } else {
          return null;
        }
      }
      result[key] = sanitizedArray;
      continue;
    }
    if (isPlainObject(child)) {
      const nested = sanitizeOptions(child, depth + 1);
      if (!nested) return null;
      result[key] = nested;
      continue;
    }
    return null;
  }
  return result;
}

function sanitizePiece(value: unknown, knownSlugs: Set<string>): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 120) return null;
  const piece = value.toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(piece) || !knownSlugs.has(piece)) return null;
  return piece;
}

type StableJson = null | boolean | number | string | StableJson[] | { [key: string]: StableJson };

function stableValue(value: unknown): StableJson {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isPlainObject(value)) {
    const result: { [key: string]: StableJson } = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = stableValue(value[key]);
    }
    return result;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  throw new TypeError("Banner config contains a non-JSON value");
}

export function bannerConfigKey(config: BannerConfig): string {
  return JSON.stringify(stableValue(config));
}

export function parseBannerConfig(
  value: unknown,
  knownSlugs: Set<string>,
): BannerConfig | null {
  if (!isPlainObject(value) || value.version !== 1) return null;
  const piece = sanitizePiece(value.piece, knownSlugs);
  if (!piece) return null;

  const mode: BannerMode = value.mode === undefined ? "animated" : value.mode as BannerMode;
  if (mode !== "animated" && mode !== "still") return null;

  let fps: number | undefined;
  if (value.fps !== undefined) {
    if (typeof value.fps !== "number" || !Number.isFinite(value.fps)) return null;
    fps = Math.min(120, Math.max(0, value.fps));
  }

  let options: Record<string, unknown> | undefined;
  if (value.options !== undefined) {
    const sanitized = sanitizeOptions(value.options);
    if (!sanitized) return null;
    options = sanitized;
  }

  return {
    version: 1,
    piece,
    source: `${SOURCE_PREFIX}${encodeURIComponent(piece)}/`,
    mode,
    ...(fps === undefined ? {} : { fps }),
    ...(options === undefined ? {} : { options }),
  };
}

export function readBannerConfig(
  metadata: Pick<CachedMetadata, "frontmatter"> | undefined,
  knownSlugs: Set<string>,
): BannerConfig | null {
  return parseBannerConfig(metadata?.frontmatter?.["ascii-banner"], knownSlugs);
}

export async function writeBannerConfig(
  app: App,
  file: TFile,
  config: BannerConfig,
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    frontmatter["ascii-banner"] = {
      version: 1,
      piece: config.piece,
      source: `${SOURCE_PREFIX}${encodeURIComponent(config.piece)}/`,
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
