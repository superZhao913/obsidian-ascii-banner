import type { Meta, Piece } from "ascii.rest";

export type BannerMode = "animated" | "still";

export interface BannerConfig {
  version: 1;
  piece: string;
  source: string;
  mode: BannerMode;
  fps?: number;
  options?: Record<string, unknown>;
}

export interface PieceCatalogItem {
  slug: string;
  title: string;
  category?: string;
  note?: string;
  fps?: number;
  canvas?: boolean;
  meta?: Meta;
}

export type AsciiPiece = Piece;

export interface RuntimeHandle {
  dispose(): void;
}
