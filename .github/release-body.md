## Aqua 玻璃主题 v2.0.3 — 字体功能与设置页的审查修复

本版是一次系统性代码审查后的修复版本，**没有新功能**（除交互细节）。审查对象是字体功能与重写的【玻璃主题】设置页，共修掉 4 项严重、12 项中等与十余项低危问题。行为兼容，仅一处本地存储键拆分为二并自动迁移。

### 字体存储

| 问题 | 修复 |
|---|---|
| 一条不足 4 字节的坏记录会让 `fontFormat()` 抛 `RangeError`，中断整批 `@font-face` 注入；调用侧又吞掉 reject —— 字体列表清空且没有删除入口，只能清 IndexedDB 自救 | 逐条校验、跳过并清理坏记录，单条损坏不再拖垮整批 |
| 导入不校验体积与格式 | 24 MB 上限 + sfnt/woff 魔数白名单；`.ttc` 明确拒绝（`@font-face` 无法寻址集合内单个字重） |
| family 名取自字体文件却直接拼进 CSS，构造 `"` 与 `}` 即可注入任意 CSS | 统一清洗后再进样式表 |
| name 表只认 `language 0x409`，中文系统字体名回落成文件名 | en-US 优先、本地化名字兜底，补 Mac Roman 分支 |
| 删除字体后设置仍指向已删 family，面板显示「跟随主题」而实际未生效 | 删前确认、删后清引用 |
| 同名 family 重复导入产生永远选不中的死行 | 复用已有记录，加载时归并历史重复项 |
| blob URL 只增不减（注释写着 revoke，代码没写） | 显式回收，注入时清理失效 URL |
| 导入后不校验就弹「导入成功」 | `document.fonts.load()` 实测，失败如实提示 |

### 设置页

- **背景亮度拆成两个字段** —— 此前是单字段 + 随外观切换的旋钮范围，切外观会静默丢弃另一半的值：亮色下设 80、切到暗色后旋钮显示被夹到 50，真实值仍是 80，一拖动就把亮色的设置覆盖掉。现拆为 `bgBrightnessLight` / `bgBrightnessDark`，旧键按 `>50` / `<50` 一次性迁移后删除。
- **数字输入框可用** —— 改为本地草稿 + 失焦/回车提交。此前每次按键都写进受控值并立刻夹取，想输 18 敲 1 就被夹成 10。影响面板上全部 30 余个旋钮。
- **字体下拉不再被裁** —— 改 fixed 定位 + 空间不足向上翻转；语义改为 `menu` + `menuitemradio`（`listbox` 的直接子元素是 `div`，本就不合 ARIA 结构）。
- **字重滑块标出刻度** —— 300–800 只有 6 个档位，此前界面上看不出来，容易被当成滑动卡顿。
- **记住上次的标签页** —— 写入 `dsh.ui-aqua.panelTab`，切页回来或重启都停在原分组；未知 id 回落「背景」。
- **「重置本区」按钮** —— `resetRegion` 早已实现却没有入口；同时修正它拿全局 `hintOpacity`(80) 当区域默认值的错（区域出厂值是 92）。
- **清理死状态** —— `stats` / `rightbar` 两组的 10 个字段（`REGIONS` 只有四个区域，全链路存在但从不生效）、5 个失效的折叠 `open` 状态、4 个永不渲染的摘要。

### 性能

- **说明文字标记改为增量** —— 此前每次 DOM 变化都对每个区域 `querySelectorAll('*')` 并逐元素 `getComputedStyle()`，流式输出时等于持续数万次强制样式解析。现在首发全量、之后只处理新增节点，区域基准色按 region 缓存。
- **旋钮写入按帧合并** —— `applySettings`（约 40 个 CSS 变量 + 两次 token 合成）改用 `requestAnimationFrame`，store 镜像仍同步更新，滑块跟手。
- **字号写入去重** —— `setFontSizeRole` 不再每像素调一次宿主。

### 壁纸

- 透明 PNG 不再变黑底：优先编码 WebP（保留 alpha），浏览器不支持时铺白底再转 JPEG；无固有尺寸的 SVG 不再产出 1×1；输入限 32 MB 并给出失败提示。
- 视频存不进 IndexedDB 时不再把它交给图片解码器（必然静默失败），改为如实提示。

### 产物

`lib/client.js` **394042 字节**，摘要 `d4eb5f16…`，纯 LF；连续两次构建摘要一致。

### 安装与升级

已发布到 npm（`@zhubai0528/dsh-client-ui-aqua-community-fix@2.0.3`，公开访问）：

```sh
dsh plugin --profile desktop add @zhubai0528/dsh-client-ui-aqua-community-fix@2.0.3
```

桌面版也可走界面：左侧栏 **插件** → **添加插件** → 在「包名或地址」里填 `@zhubai0528/dsh-client-ui-aqua-community-fix`。

Windows 还可用一键脚本（默认从 npm 安装，会先清理遗留 junction）：

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

完整说明见 [README.zh.md](README.zh.md) / [README.md](README.md)，逐项改动见 [CHANGELOG.md](CHANGELOG.md)。

---

## Aqua glass theme v2.0.3 — review fixes for the typography work and the settings page

A review-driven release with **no new features** (bar interaction details). The audit covered the font feature and the rewritten Glass theme panel: 4 severe, 12 medium and a dozen low-severity issues. Behaviour-compatible, except one local storage key that is now split in two and migrated automatically.

### Font storage

| Problem | Fix |
|---|---|
| A record shorter than 4 bytes made `fontFormat()` throw `RangeError`, aborting the whole `@font-face` injection; the caller swallowed the rejection — the list went empty with no delete affordance, recoverable only by clearing IndexedDB | Each record is validated on its own; a broken one is skipped and pruned instead of taking the batch down |
| Imports were not checked for size or format | 24 MB cap plus an sfnt/woff magic-number allowlist; `.ttc` is refused outright (`@font-face` cannot address one weight inside a collection) |
| The family name came from the font file and was interpolated into CSS, so `"` and `}` injected arbitrary rules | Sanitised before it reaches the stylesheet |
| The name table only honoured `language 0x409`, so Chinese system faces fell back to their filename | en-US first, localised names as fallback, Mac Roman branch added |
| Deleting a face left settings pointing at it — the panel showed "Theme default" while the dead family was still set | Confirmed before delete, references cleared after |
| Re-importing the same family produced a row that could never be selected | The existing record is reused; historical duplicates are merged on load |
| Blob URLs were never revoked (the comment claimed they were) | Revoked explicitly, stale URLs collected on each injection |
| The panel announced "imported" without verifying anything | `document.fonts.load()` actually runs, and failures are reported |

### Settings page

- **Background brightness split in two** — one field plus a knob range that followed the scheme meant flipping the appearance silently discarded the other half: set 80 in light mode, switch to dark and the knob clamps to 50 while the real value stays 80, so the first drag overwrites the light setting. Now `bgBrightnessLight` / `bgBrightnessDark`, with the old key migrated by `>50` / `<50` and then removed.
- **Number boxes usable** — a local draft commits on blur/Enter. Previously every keystroke was written to the controlled value and clamped, so typing 18 turned the "1" into 10. This affected all 30-odd knobs.
- **Font dropdown no longer clipped** — fixed positioning that flips upward near the bottom edge; semantics moved to `menu` + `menuitemradio` (a `listbox` whose direct children are `div`s was invalid anyway).
- **Weight sliders label their stops** — 300–800 has only six stops; without labels the stepping read as stutter.
- **Last tab remembered** — stored under `dsh.ui-aqua.panelTab`; returning or restarting lands on the same group, unknown ids fall back to Backdrop.
- **Per-region reset button** — `resetRegion` existed with no way to reach it; it also reset to the global `hintOpacity`(80) instead of the region's shipped 92.
- **Dead state removed** — the ten `stats` / `rightbar` fields (`REGIONS` has four entries, so nothing ever consumed them), five unreachable fold flags, four summaries that were never rendered.

### Performance

- **Hint marking is incremental** — it used to run `querySelectorAll('*')` over every region and call `getComputedStyle()` per element on each DOM change, i.e. tens of thousands of forced style resolutions while a response streams. Now one full pass, then only the newly added nodes, with per-region target colours cached.
- **Knob writes coalesced per frame** — `applySettings` (~40 CSS variables plus two token composites) runs at most once per frame; the store mirror still updates synchronously so the slider tracks the pointer.
- **Font-size writes deduped** — `setFontSizeRole` no longer calls the host per pixel.

### Wallpaper

- Transparent PNGs no longer turn black: WebP is preferred (alpha preserved), with a white flatten before JPEG when the browser cannot encode it; SVGs without intrinsic size no longer produce a 1×1; input is capped at 32 MB with a real error message.
- When a video cannot be stored in IndexedDB it is no longer handed to an image decoder (a guaranteed silent failure) — the failure is reported instead.

### Artifact

`lib/client.js` is **394042 bytes**, digest `d4eb5f16…`, pure LF; two consecutive builds produce the same digest.

### Install / upgrade

Published to npm as `@zhubai0528/dsh-client-ui-aqua-community-fix@2.0.3`:

```sh
dsh plugin --profile desktop add @zhubai0528/dsh-client-ui-aqua-community-fix@2.0.3
```

Full details in [README.md](README.md) / [README.zh.md](README.zh.md), per-change notes in [CHANGELOG.md](CHANGELOG.md).
