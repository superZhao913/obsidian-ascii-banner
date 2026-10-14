# ASCII Banner for Obsidian

把开源的 [ascii.rest](https://ascii.rest/) ASCII 动画库用作 Obsidian 笔记顶部的 banner（横幅）。

插件将 `ascii.rest@0.4.0`（MIT，作者 [bas3line](https://github.com/bas3line)）的完整运行时与全部 217 个官方图案打包进插件，因此：

- 笔记中不执行任何远程 `<script>` 或 HTML；
- 离线也能浏览、选择和渲染已打包的图案；
- `kyoto-dusk` 这类彩色动态图案以原生 Canvas 渲染并在 Obsidian 内播放。

## 安装（从源码构建）

```bash
git clone <this-repo>
cd obsidian-ascii-banner
npm install
npm run build
```

构建后把以下文件复制到 `<你的库>/.obsidian/plugins/ascii-banner/`：

- `main.js`
- `manifest.json`
- `styles.css`

然后在 Obsidian 的 **设置 → 第三方插件** 中启用 “ASCII Banner”。

开发模式使用 `npm run dev`（esbuild watch）。

## 使用

打开任意 Markdown 笔记，在命令面板中运行：

| 命令 | 作用 |
| --- | --- |
| **设置 / 更换 ASCII Banner 图案** | 打开图案选择器：按名称/分类/描述搜索，右侧实时预览，可选择“动画”或“静止首帧”，点击“应用到当前笔记”写入配置；已有 banner 时用于更换图案 |
| **清除 ASCII Banner** | 删除当前笔记的 `ascii-banner` frontmatter 字段（其他字段保持不变） |
| **切换 ASCII Banner：动画 ⇄ 静止** | 把当前笔记已有的图案在“播放动画”和“静止首帧”之间切换（不更换图案） |
| **刷新 ascii.rest 图案目录** | 从网站刷新图案显示名称；失败时保留内置目录并提示 |

Banner 会同时出现在**阅读模式**和**实时预览（Live Preview）**中，位于文档内容之前。

## 数据格式

选择结果保存在笔记的 YAML frontmatter 中，不修改正文：

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

- `piece`：必须是内置官方图案 slug；未知 slug 会被忽略。
- `mode`：`animated`（默认）或 `still`。
- `fps`：可选，0–120，覆盖图案默认帧率。
- `options`：可选，仅接受 JSON 安全的普通对象（如 `{"text": "hello"}`），用于支持参数的图案。
- 配置随笔记同步/迁移，不依赖任何本地状态。

## 动态行为与生命周期

- 动画默认播放；切换为静止时显示该图案的首帧/`still` 帧。
- 图案滚出视口、文档隐藏或切换到其他笔记时自动暂停/销毁，不在后台占用资源。
- 遵循系统的“减少动态效果”（prefers-reduced-motion）设置。
- 图案加载失败时优先显示缓存帧；没有缓存时显示可读的错误占位，正文不受影响。

## 安全与隐私

- frontmatter 仅被当作数据解析；不会执行笔记中的脚本、HTML 或任意模块地址。
- 只接受内置官方图案；不支持第三方 `src` 模块。
- 唯一的网络请求是可选的“刷新图案目录”（读取 ascii.rest 首页的公开链接列表）；失败自动回退到内置目录。
- 插件不包含任何统计或上报。

## 已知限制

- 移动端可运行，但大尺寸彩色 Canvas 图案（如 200×100 的场景类）在低端设备上可能较耗电；建议使用静止模式或较小图案。
- Live Preview 的 frontmatter 解析器只识别插件自身写入的受限子集；手工书写的复杂 YAML（如多行 `options`）在 Live Preview 中可能不显示 banner，阅读模式不受影响。
- 选择器预览以较小字号渲染，仅用于确认图案；实际效果以笔记内为准。
- 不支持把动画导出为 GIF/视频，也不支持自定义图案（ascii.rest 官方目录之外）。

## 验证

```bash
npm test          # 26 项单元测试（frontmatter/目录/运行时/阅读模式/Live Preview 解析）
npm run typecheck # TypeScript 严格模式
npm run build     # 产出 main.js
```

手工验收清单：选择 `kyoto-dusk` → 阅读模式与 Live Preview 均显示在正文之前；切换静止模式动画停止；切换笔记后旧动画被销毁；清除 banner 后正文与其他 frontmatter 字段不变；断网后仍可浏览内置目录并显示缓存帧；窄窗口下 Canvas 不溢出容器。

## 许可

本插件以 MIT 发布（见 `LICENSE`）。内置的 ascii.rest 库以 MIT 发布，版权归 bas3line 所有（见 `licenses/ascii.rest.MIT.txt`）。
