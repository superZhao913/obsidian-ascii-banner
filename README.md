# ASCII Banner for Obsidian

Use the open-source [ascii.rest](https://ascii.rest/) animated ASCII art library as a banner at the top of an Obsidian note.

> Early development build. The plugin bundles `ascii.rest@0.4.0` (MIT, by [bas3line](https://github.com/bas3line)) so notes do not execute remote scripts and can render bundled pieces offline.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Copy `main.js`, `manifest.json`, `styles.css`, and `LICENSE` into `<vault>/.obsidian/plugins/ascii-banner/`, enable the plugin, and reload Obsidian.

## Planned commands

- **设置 ASCII Banner** — search the official bundled catalog and apply a piece to the active note.
- **清除 ASCII Banner** — remove only the `ascii-banner` YAML field.
- **切换 ASCII Banner 动画** — switch the current note between animated and still rendering.
- **刷新 ascii.rest 图案目录** — refresh display metadata from the website; bundled pieces remain the fallback.

## Note format

The selection is stored in YAML frontmatter instead of inserting scripts or HTML into the note body:

```yaml
---
ascii-banner:
  version: 1
  piece: kyoto-dusk
  source: https://ascii.rest/kyoto-dusk/
  mode: animated
  fps: 15
  options: {}
---
```

Only bundled ascii.rest piece slugs are accepted. `mode` is `animated` or `still`; `fps` is optional and limited to 0–120. The plugin ignores invalid configurations without hiding the note body.

## Dynamic behavior

Animated pieces such as `kyoto-dusk` use the bundled ascii.rest runtime and preserve the library's `<pre>` or Canvas rendering. Animation pauses when the document is hidden or outside the viewport. A still mode shows the piece's still/first frame and follows the system reduced-motion preference. If loading a piece fails, the plugin shows a safe text fallback.

## Security and privacy

- Frontmatter is treated as data. The plugin never runs scripts, HTML, or arbitrary `src` modules from a note.
- The optional catalog refresh only reads known links from `https://ascii.rest/`; failure keeps the bundled catalog available.
- No analytics or user content is sent by this plugin. The only network request is the optional catalog refresh.

## Manual acceptance checklist

1. Select `kyoto-dusk` and verify it appears before the note body in Reading View and Live Preview.
2. Toggle still mode and verify RAF animation stops while a frame remains visible.
3. Switch notes or hide the window and verify the banner is cleaned up.
4. Clear the banner and verify the body/frontmatter's unrelated fields remain intact.
5. Disable network access and verify the bundled catalog and bundled pieces still work.
6. Resize a narrow/mobile view and verify a Canvas piece remains inside the banner container.

See `licenses/ascii.rest.MIT.txt` for the bundled dependency's license.
