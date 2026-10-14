import { parseBannerConfig } from "./frontmatter";
import type { BannerConfig } from "./types";

function parseScalar(raw: string): string | number | boolean | null {
  const value = raw.trim();
  if (value === "" || value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  const quoted = /^(?:"([^"]*)"|'([^']*)')$/.exec(value);
  if (quoted) return quoted[1] ?? quoted[2];
  const number = Number(value);
  if (!Number.isNaN(number) && value !== "") return number;
  return value;
}

function parseOptions(raw: string): Record<string, unknown> | null {
  const value = raw.trim();
  if (value === "{}") return {};
  if (!value.startsWith("{") || !value.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseBannerFromEditorText(
  text: string,
  knownSlugs: Set<string>,
): BannerConfig | null {
  try {
    if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return null;
    const newline = text.startsWith("---\r\n") ? "\r\n" : "\n";
    const lines = text.split("\n");
    if (lines[0].trim() !== "---") return null;

    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        end = i;
        break;
      }
    }
    if (end < 0) return null;
    void newline;

    const block = lines.slice(1, end);
    const bannerIndex = block.findIndex((line) => /^ascii-banner\s*:\s*$/.test(line));
    if (bannerIndex < 0) return null;

    const value: Record<string, unknown> = {};
    for (let i = bannerIndex + 1; i < block.length; i++) {
      const line = block[i];
      if (/^\S/.test(line)) break;
      const match = /^\s{2,}([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, raw] = match;
      if (key === "options") {
        const options = parseOptions(raw);
        if (options === null) return null;
        value.options = options;
      } else {
        value[key] = parseScalar(raw);
      }
    }

    if (typeof value.version === "string") {
      const coerced = Number(value.version);
      if (Number.isNaN(coerced)) return null;
      value.version = coerced;
    }

    return parseBannerConfig(value, knownSlugs);
  } catch {
    return null;
  }
}
