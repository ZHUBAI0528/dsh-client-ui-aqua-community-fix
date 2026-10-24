## Aqua 玻璃主题 v2.0.0 — 适配 DSH V0.2.1-rc.2

**版本号统一为 2.0.0。** 此前发布的 2.1.0 / 2.1.1 已作废，其内容全部并入本版，无功能丢失。本版以 **DSH 桌面端 V0.2.1-rc.2** 为基准构建与验证（`engines.dsh: ">=0.2.1-rc.2 <0.3.0"`）。

### 破坏性变更

- **移除「兼容模式」与其切换入口**：主题恒为云母（浮动玻璃）布局；`dsh.ui-aqua.mode` 存储键不再读取（旧值保留，不影响使用）
- 移除上下渐变模糊带；可读性由主列 veil 承担，13px 边缘淡出保留
- 移除「悬停下压」（3D 倾斜）及其存储键
- 插件 id 仍为 `ui-aqua`，localStorage 键（`dsh.ui-aqua.*`）不变，已有用户的设置原样沿用

### 视觉与交互

- **页头统一**：宿主两套页头标记（`<header class="pageHead">` 与 `<div class="pageHeading">`）纳入同一套卡片配方，插件页与自动化任务页顶栏外观一致；卡片与内容列同宽
- **接缝模糊「只糊沟槽」**：仅在页面边界与浮动玻璃之间做纯 `backdrop-filter`，无染色、无遮罩；统计栏圆弧底边不受影响
- 输入框与状态栏合并为**一块连续玻璃**（消除 6px 缝隙）
- 新增「子菜单不透明度」（默认 96%）、「子菜单交互 → 点击保持展开」
- 修复浅色模式会话区整片发白、深色切换不跟随、冷启动流体不绘制

### 审计修复

- 性能：三处全文档 `MutationObserver` 合并为单一共享 DOM 变更源，按帧合并 + 引用计数摘除
- 兼容性：页头玻璃规则收窄到主列，不再改写其它插件渲染的 `<header>`
- 行为：关闭主题时一并释放「子菜单点击保持展开」补丁
- 隐私：删除/更换壁纸时清除 IndexedDB 中记住的本地文件授权句柄
- 供应链：`npm run bundle` 生成 `SHA256SUMS.txt`，`install.ps1` 按同 ref 校验

### 类型与依赖

- **图标名以宿主运行时为准**：本地 types 曾解析到改名版本（`·16` 后缀），但宿主只解析 `·Regular` —— 扫描 `app.asar` 证实旧名命中 18 次、新名 0 次。开发依赖已钉到宿主同版，源码保持运行时真实名字
- peer 范围收紧为 `>=0.2.1-rc.2 <0.3.0`（宽范围会放行图标名互不兼容的版本组合）
- `npm run typecheck` 从 14 条既有错误清零；客户端产物仅多出 picker 判空 6 增 3 删
- 移除三个未使用依赖

安装（桌面版，推荐）：打开 DeepSeek Harness V0.2.1-rc.2 → 左侧栏 **插件** → **添加插件** → 在「包名或地址」中填入：

```
github:zhubai0528/dsh-client-ui-aqua-community-fix
```

本版已发布到 npm（`@zhubai0528/dsh-client-ui-aqua-community-fix@2.0.0`，公开访问），命令行一条搞定：

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

Windows 也可用 GitHub 安装器（不需要 npm、不需要 git）：

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

完整说明见 [README.zh.md](README.zh.md) / [README.md](README.md)，变更明细见 [CHANGELOG.md](CHANGELOG.md)。

---

## Aqua glass theme v2.0.0 — for DSH V0.2.1-rc.2

**Version unified as 2.0.0.** The previously published 2.1.0 / 2.1.1 are superseded; their contents are folded into this release with nothing lost. Built and verified against **DSH desktop V0.2.1-rc.2** (`engines.dsh: ">=0.2.1-rc.2 <0.3.0"`).

### Breaking changes

- **Mode switching removed**: the theme is always the Mica (floating glass) layout; the `dsh.ui-aqua.mode` key is no longer read (old value kept, harmless)
- Edge gradient blur bands removed; readability is carried by the main-column veil, 13px edge fade kept
- Hover-press (3D tilt) and its storage key removed
- Plugin id stays `ui-aqua` and the `dsh.ui-aqua.*` keys are unchanged — existing settings carry over

### Visuals and interaction

- **Unified page heads**: both host shapes (`<header class="pageHead">`, `<div class="pageHeading">`) share one card recipe; the card now spans the content column
- **Seam blur covers gutters only**: plain `backdrop-filter` between page boundary and floating glass, no tint, no mask; the dock's rounded edge is untouched
- Composer and stats line merged into **one continuous pane of glass** (6px gap gone)
- New: submenu opacity (96% default), click-to-hold submenu behaviour
- Fixed: all-white light-mode conversation area, dark-mode not following, cold-start fluid never painting

### Audit fixes

- Perf: three document-wide `MutationObserver`s merged into one shared, frame-coalesced feed
- Compatibility: page-head glass rule scoped to the main column
- Behaviour: turning the theme off releases the submenu click-hold shim
- Privacy: the remembered file handle is dropped when the wallpaper is removed or replaced
- Supply chain: `npm run bundle` writes `SHA256SUMS.txt`; `install.ps1` verifies against it

### Types and dependencies

- **Glyph names follow the host runtime**: local typings had resolved to a renamed build (`16` suffix) while the host resolves only `Regular` — an `app.asar` scan shows 18 hits for the old names and zero for the new. Dev dependency pinned to the host version; source keeps the runtime names
- peer range tightened to `>=0.2.1-rc.2 <0.3.0`
- `npm run typecheck` went from 14 errors to zero; artifact differs by 6 added / 3 removed lines, all in the picker guard
- Three unused dependencies removed

Install (desktop app, recommended): open DeepSeek Harness V0.2.1-rc.2 → **Plugins** in the left sidebar → **Add plugin** → enter this in the "package name or address" field:

```
github:zhubai0528/dsh-client-ui-aqua-community-fix
```

This version is also published to npm (`@zhubai0528/dsh-client-ui-aqua-community-fix@2.0.0`, public), so one command does it:

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

On Windows, the GitHub installer needs neither npm nor git:

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

See [README.md](README.md) / [README.zh.md](README.zh.md) for details and [CHANGELOG.md](CHANGELOG.md) for the full list.
