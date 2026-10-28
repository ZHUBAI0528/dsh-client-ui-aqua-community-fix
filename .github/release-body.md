## Aqua v2.0.3 — 现在能改字了

2.0.2 是个适配版（对齐 DSH 0.2.1-rc.3，界面没动）。这一版不一样：**字体、字号、字重、配色都可以自己调**，面板也从四组按钮换成六个标签页。可调项从 17 项增加到 40 多项。

### 新增

- **字体能换了** —— 正文、代码、说明文字各有一个字体下拉，内置系统字体（微软雅黑、宋体、楷体、Consolas…）、开源（思源黑体/宋体、霞鹜文楷、JetBrains Mono）、免费商用（MiSans、鸿蒙 Sans）三类预设；也能导入自己的字体，支持 `.ttf` / `.otf` / `.woff` / `.woff2`，单个最大 24 MB，存在本地，重启不丢。
- **字号与字重** —— 正文 10–22 px、代码 10–16 px、终端 10–20 px；正文与标题字重 300–800（6 档，滑块下方标出刻度）。说明文字可以单独定字体、字重和浓度（40–100%）。
- **行间距** 1–2.5 可调。
- **配色方案** —— 正文、会话区、说明文字各有一套独立配色，「字体颜色」标签页里切换。
- **按区域微调** —— 左侧边栏 / 顶部栏 / 会话区 / 底部输入框四个区域，字重与说明文字分别调，可单独重置。
- **面板改版** —— 六个标签页：玻璃材质 / 背景 / 字体字号 / 字体颜色 / 区域 / 装饰。打开时停在上次那一页，不用每次重新找。
- **两处新的模糊** —— 会话详情模糊度、菜单页模糊度（0–40 px），可以只模糊对话区而不影响其它页面。
- **面板内直接切外观** —— 浅色 / 深色 / 跟随系统，与「设置 → 外观」是同一个开关，两边改都同步。

### 改进

- **拖滑块更跟手** —— 样式写入改成每帧最多一次（原来每移动一像素就全量重算 40 个 CSS 变量）。
- **长会话不再卡** —— 说明文字的标记逻辑改成只处理新增节点（原来每次界面变化都全页扫描逐元素取样式）。
- **透明 PNG 壁纸不再变黑底** —— 改存 WebP 保留透明通道，浏览器不支持时铺白底。
- **字体下拉不再被裁** —— 靠近面板底部时自动向上翻，不会被滚动区域切掉。

### 修复

- 一条损坏的字体记录曾会让**整个字体列表消失**，而且没有删除入口，只能清浏览器数据自救 —— 现在只跳过坏的那条。
- 切换深浅色后「背景亮度」会被悄悄覆盖（亮色设了 80，切到暗色一拖动就没了）—— 现在两种外观各存一份。
- 数字输入框**想输 18 却变成 10** —— 现在正常输入，失焦或回车才生效，面板上 30 多个旋钮都受益。
- 删除字体后设置仍指向它，界面显示「跟随主题」但实际没生效 —— 删除时一并回退。
- 视频壁纸存不下时静默失败 —— 现在明确提示。
- 说明文字浓度重置会跳到一个从未使用过的值 —— 现在回到出厂值。

### 从 2.0.2 升级

```sh
dsh plugin --profile desktop add @zhubai0528/dsh-client-ui-aqua-community-fix@2.0.3
```

设置会沿用，只有「背景亮度」拆成了深色/浅色两份，旧值自动迁移，不用重设。

产物 `lib/client.js` 394042 字节，摘要 `d4eb5f16…`。逐项技术清单见 [CHANGELOG.md](CHANGELOG.md)，完整功能说明见 [README.zh.md](README.zh.md)。

---

## Aqua v2.0.3 — you can finally change the type

2.0.2 was a compatibility release (aligned to DSH 0.2.1-rc.3, no UI changes). This one is different: **fonts, sizes, weights and colours are yours to set**, and the panel went from four button groups to six tabs. The number of adjustable settings went from 17 to over 40.

### New

- **Swappable faces** — body, code and explanatory copy each get their own picker, with built-in presets (Microsoft YaHei, SimSun, KaiTi, Consolas, Source Han Sans/Serif, LXGW WenKai, JetBrains Mono, MiSans, HarmonyOS Sans) and local imports: `.ttf`, `.otf`, `.woff` or `.woff2`, up to 24 MB each, stored locally so they survive restarts.
- **Sizes and weights** — body 10–22 px, code 10–16 px, terminal 10–20 px; body and heading weights 300–800 in six labelled stops. Explanatory text gets its own face, weight and strength (40–100%).
- **Line height** from 1 to 2.5.
- **Colour palettes** — separate schemes for body copy, the conversation and explanatory text.
- **Per-region control** — sidebar, header, conversation and composer can each carry their own weight and explanatory styling, with a one-click reset per region.
- **New panel** — six tabs (Glass material / Backdrop / Font & size / Font colours / Regions / Decorations) that reopen on the tab you left.
- **Two new blur knobs** — conversation blur and menu-page blur (0–40 px), so you can blur the transcript without touching anything else.
- **Appearance switch inside the panel** — light / dark / follow system, the same setting as Settings → Appearance, kept in sync both ways.

### Improvements

- **Sliders track the pointer** — style writes are coalesced to at most one per frame (previously every pixel recomputed ~40 CSS variables).
- **Long conversations stay smooth** — explanatory-text marking now only looks at newly added nodes instead of rescanning the page on every change.
- **Transparent PNG wallpapers no longer go black** — stored as WebP with the alpha channel intact, falling back to a white flatten.
- **The font dropdown is no longer clipped** — it flips upward near the bottom edge instead of being cut off by the scroll area.

### Fixes

- One corrupt font record used to make the **entire font list disappear**, with no delete entry left — recoverable only by clearing browser data. Now only the broken record is skipped.
- Flipping between light and dark silently overwrote **background brightness** — each appearance now keeps its own value.
- Number boxes turned a typed **18 into 10** — they now accept input normally and commit on blur or Enter, across all 30-odd knobs.
- Deleting a font left settings pointing at it, so the panel said "Theme default" while the dead face was still set — references are now cleared.
- A video wallpaper that could not be stored failed silently — it now says so.
- Resetting explanatory strength jumped to a value that was never a default — it now returns to the shipped one.

### Upgrading from 2.0.2

```sh
dsh plugin --profile desktop add @zhubai0528/dsh-client-ui-aqua-community-fix@2.0.3
```

Your settings carry over; only background brightness was split into a dark and a light value, and the old one migrates automatically.

Artifact: `lib/client.js`, 394042 bytes, digest `d4eb5f16…`. Per-change notes in [CHANGELOG.md](CHANGELOG.md), full documentation in [README.md](README.md).
