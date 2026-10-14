# Obsidian ASCII Banner 设计说明

## 目标

开发一个可安装到 Obsidian 的插件，让用户从 ascii.rest 的官方 ASCII art pieces 中选择静态或动态图案，作为 Markdown 笔记顶部的 banner。选择结果写入笔记 YAML frontmatter，阅读模式和 Live Preview 都渲染同一个 banner；动态图案在可见时播放，离开视图时暂停。

## 已确认的外部协议

ascii.rest 0.4.0 是 MIT 许可的开源库，官方目录包含 236 个 pieces。一个 piece 是 `{ meta, default }`：

- `meta.name/category/note` 提供显示信息；
- `meta.cols/rows/fps` 描述尺寸和默认帧率；`fps: 0` 表示静态；
- `meta.palette/ground/cell` 表示彩色 Canvas 渲染所需信息；没有 palette 的 piece 使用单色文本；
- `meta.options` 是 piece 的默认参数；
- `meta.still` 是静止或减少动画时建议显示的时间点；
- `default(options)` 返回 `frame(t, env?)`，以秒为参数生成一帧；
- `mount(element, piece, options)` 已实现 `<pre>`/`<canvas>`、ResizeObserver、requestAnimationFrame、IntersectionObserver、页面隐藏暂停和 reduced-motion 处理。

插件使用 `ascii.rest` npm 包将官方运行时与 pieces 打包进 `main.js`，而不是在笔记中执行 `<script>` 或任意远程模块。这样既能支持 `kyoto-dusk` 一类动态 Canvas piece，也能在离线时继续使用已经打包的官方图案。插件不支持 frontmatter 中的 `src` 任意模块。

## 用户体验

### 命令

插件注册以下命令：

- `设置 ASCII Banner`：打开图案选择器；选择并点击应用后写入当前笔记。
- `清除 ASCII Banner`：删除当前笔记的 `ascii-banner` frontmatter 字段。
- `切换 ASCII Banner 动画`：在当前笔记的 `animated` 与 `still` 模式间切换；没有 banner 时给出 Notice。
- `刷新 ascii.rest 图案目录`：可选地请求 ascii.rest 首页刷新显示目录；请求失败时保留内置目录并给出明确 Notice。

选择器立即显示内置的官方 236 项目录，支持按名称和分类文本搜索。选择某一项后在预览区加载该 bundled piece；彩色 piece 保留 Canvas，文本 piece 使用 `<pre>`。预览区提供播放/静止切换、关闭和应用按钮。应用到当前文件后，当前阅读/编辑视图通过 workspace 事件刷新，无需手动重开文件。

### 动画行为

- 新选择的 piece 默认使用 `animated` 模式和官方默认 fps；frontmatter 中显式的 `fps` 可覆盖默认值。
- `still` 模式把传给运行时的 fps 设为 0，显示 piece 的首个或 `meta.still` 帧。
- 动画仍遵循系统 `prefers-reduced-motion`，并由 ascii.rest runtime 的 IntersectionObserver、`document.visibilityState` 控制生命周期；插件不在不可见的文档后台运行 RAF。
- 运行时加载异常时显示缓存的首帧；如果尚未生成首帧，则显示可读的错误占位文本和恢复提示，不破坏正文。

## 持久化格式

每篇笔记使用以下 YAML frontmatter。字段名保持稳定，便于同步和手工编辑：

```yaml
ascii-banner:
  version: 1
  piece: kyoto-dusk
  source: https://ascii.rest/kyoto-dusk/
  mode: animated
  fps: 15
  options: {}
```

约束：

- `piece` 必须是 bundled 官方目录中的合法 slug；
- `source` 由插件按 piece 生成并限制为 `https://ascii.rest/<piece>/`；
- `mode` 只能是 `animated` 或 `still`；
- `fps` 为可选的有限数字，限制在 0–120；
- `options` 必须是有限深度、JSON 可序列化的普通对象，不允许函数、HTML、脚本或任意模块地址；
- `version` 用于未来迁移，当前只接受 1；未知/非法配置按“没有 banner”处理并通过 Notice 说明。

所有读写通过 Obsidian `metadataCache` 和 `fileManager.processFrontMatter` 完成，不通过字符串拼接 YAML，避免破坏其他属性和用户格式。清除操作只删除 `ascii-banner` 字段，保留其他 frontmatter。

## 架构

项目为独立 TypeScript Obsidian 插件，目录为 `/Users/superxiaoshu/obsidian-ascii-banner/`。模块职责如下：

- `src/main.ts`：插件生命周期、命令、事件、Markdown postprocessor、Live Preview 扩展注册。
- `src/types.ts`：`BannerConfig`、`BannerMode`、`PieceCatalogItem`、运行时句柄等公共类型。
- `src/frontmatter.ts`：配置验证、规范化、从 metadata/editor 文本读取、`processFrontMatter` 写入/删除。
- `src/catalog.ts`：使用 `ascii.rest` 内置 `names/load` 建立目录，缓存 piece metadata；可选请求 ascii.rest 首页，仅接受已知 slug。
- `src/ascii-runtime.ts`：调用打包的 `load` 和 `mount`，处理动画/静止选项、首帧 fallback、异步加载和销毁。
- `src/banner-renderer.ts`：统一创建 banner 容器并挂载运行时，确保阅读模式和 Live Preview 使用一致样式。
- `src/markdown-renderer.ts`：注册 Markdown postprocessor，在阅读模式文档容器最前插入 banner，并通过 `MarkdownRenderChild` 销毁句柄。
- `src/live-preview.ts`：CodeMirror 6 `ViewPlugin`，在文档位置 0 插入不可编辑的 block widget；根据 frontmatter 文本变化重建/移除 widget。
- `src/banner-modal.ts`：Obsidian Modal 选择器、搜索列表、预览区和应用/取消交互。
- `src/styles.css`：banner 容器、Canvas/`pre`、错误状态、选择器布局和主题变量。

### 阅读模式数据流

1. Markdown postprocessor 获得 `sourcePath`。
2. 从 metadata cache 读取并验证 `ascii-banner`。
3. 有效配置时在渲染根容器最前创建 `.ascii-banner-container`。
4. `AsciiRuntime.mount` 加载 bundled piece，调用官方 `mount`；返回的 cleanup 注册到 `MarkdownRenderChild`。
5. 文件重新渲染时由 Obsidian 清理旧 child，避免重复 RAF/observer。

### Live Preview 数据流

1. 全局 CodeMirror 6 ViewPlugin 观察 `EditorView.update`。
2. 从 `EditorState.doc` 开头解析 YAML frontmatter，只识别受限的 `ascii-banner` 对象。
3. 有效配置时在位置 0 生成 block `Decoration.widget`，widget 的 DOM 由 `banner-renderer` 创建。
4. `WidgetType.eq` 按规范化配置 key 比较；配置未变时不重建，配置/文本变更时销毁旧句柄并重建。
5. widget `ignoreEvent` 返回 true，点击 banner 不改动 Markdown；正文和 YAML 文本位置保持不变。

## 安全与兼容性

- 只执行构建时审核过的 ascii.rest MIT 代码；用户 frontmatter 不会被当作 JavaScript、HTML 或模块加载。
- 远程目录刷新只解析链接并与 bundled `names` 求交集；网络请求失败不影响本地选择和渲染。
- 不依赖 Node/Electron API；Obsidian 桌面优先，移动端使用同一 Web APIs 并在 Canvas 不可用时降级为文本首帧。
- 保留 `licenses/ascii.rest.MIT.txt`，README 标注 ascii.rest 作者、版本和来源。
- 没有 `ascii-banner` 的笔记完全不插入 DOM；无效配置不会隐藏或修改正文。

## 验证范围

自动化测试覆盖：

- 配置的合法/非法值、fps 边界、options 深度和 source 规范化；
- YAML frontmatter 的读取、写入、更新、删除及保留其他字段；
- 目录解析和网络失败 fallback；
- 动态/静止运行时选项、首帧 fallback 和 cleanup 调用。

构建验证使用 `npm run build`，测试使用 `npm test`。手工验证至少包含：选择 `kyoto-dusk`；阅读模式和 Live Preview 同时显示；动画切换为静止；切换文件后动画停止；删除 banner 后正文恢复；断网后仍可从内置目录选择并显示；移动端/窄窗口下 Canvas resize 不溢出。

## 明确不在首版范围

- 不执行 ascii.rest 的远程 `<script>`、任意 `src` 模块或笔记中的 HTML；
- 不支持用户上传/自定义 piece；
- 不把动画录制成 GIF/视频或导出图片；
- 不修改正文 Markdown，不把 banner 作为可见代码块插入正文；
- 不保证第三方主题对 Live Preview 私有 DOM 结构的定制样式完全兼容。
