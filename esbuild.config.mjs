import esbuild from "esbuild";
import { copyFile } from "node:fs/promises";

const production = process.argv[2] === "production";
const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/highlight", "@lezer/lr"],
  format: "cjs",
  platform: "browser",
  target: "es2020",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
};

if (production) {
  await esbuild.build(options);
  await copyFile("styles.css", "styles.css");
} else {
  const context = await esbuild.context({ ...options, write: true });
  await context.watch();
  console.log("watching for changes...");
}
