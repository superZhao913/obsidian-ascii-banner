import { EditorState, RangeSetBuilder, StateField, Transaction } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { createBannerContainer, renderBanner } from "./banner-renderer";
import type { BannerRuntime } from "./banner-renderer";
import { bannerConfigKey } from "./frontmatter";
import { parseBannerFromEditorText } from "./live-preview-parse";
import type { BannerConfig, RuntimeHandle } from "./types";

export interface LivePreviewDeps {
  runtime: BannerRuntime;
  knownSlugs: Set<string>;
}

class BannerWidget extends WidgetType {
  private handle: RuntimeHandle | null = null;

  constructor(
    private readonly config: BannerConfig,
    private readonly runtime: BannerRuntime,
  ) {
    super();
  }

  override eq(other: BannerWidget): boolean {
    return bannerConfigKey(this.config) === bannerConfigKey(other.config);
  }

  override toDOM(): HTMLElement {
    const container = createBannerContainer(this.config);
    void renderBanner(container, this.config, this.runtime).then((handle) => {
      this.handle = handle;
    });
    return container;
  }

  override ignoreEvent(): boolean {
    return true;
  }

  override destroy(): void {
    this.handle?.dispose();
    this.handle = null;
  }
}

function buildDecorations(text: string, deps: LivePreviewDeps): DecorationSet {
  const config = parseBannerFromEditorText(text, deps.knownSlugs);
  if (!config) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  builder.add(0, 0, Decoration.widget({
    widget: new BannerWidget(config, deps.runtime),
    side: -1,
    block: true,
  }));
  return builder.finish();
}

export function createLivePreviewExtension(deps: LivePreviewDeps): Extension {
  // Block widgets are only legal in StateField-provided decorations; a
  // ViewPlugin-provided block decoration throws RangeError and breaks the view.
  return StateField.define<DecorationSet>({
    create: (state: EditorState) => buildDecorations(state.doc.toString(), deps),
    update: (value: DecorationSet, transaction: Transaction) => {
      if (!transaction.docChanged) return value;
      return buildDecorations(transaction.state.doc.toString(), deps);
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}
