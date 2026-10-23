## Aqua 玻璃主题 v2.1.0 — 适配 DSH V0.2.1-rc.2

本版本以 **DSH 桌面端 V0.2.1-rc.2** 为基准构建与验证（`engines.dsh` 同步声明 `>=0.2.1-rc.2 <0.3.0`）。

### 视觉统一

- 页头卡片统一：宿主同一功能用了两套标记 —— 插件页是 `<header class="pageHead">`，自动化任务页是 `<div class="pageHeading">`。现已合并为同一组选择器，两页顶栏外观一致
- 页头卡片宽度对齐内容列（此前左右各内缩 16px，比内容窄 32px）；会话区顶栏保留 16px 槽以对齐输入框
- 修复插件页顶栏内部多出一层圆角小框（`pageHeading` 嵌在 `pageHead` 内，两层各画了一张卡）
- 接缝模糊改为「只糊沟槽」：`top` 从页面上边界到顶栏卡片上沿，`foot` 从统计栏底边到页面下边界。均为纯 `backdrop-filter`，无染色、无遮罩；统计栏圆弧底边不受影响

### 审计修复

- 性能：三处全文档 `MutationObserver` 合并为一个共享 DOM 变更源，回调按帧合并，引用计数归零即摘除
- 兼容性：页头玻璃卡规则收窄到主列，不再改写其它插件渲染的 `<header>`
- 行为一致性：关闭主题时一并释放「子菜单点击保持展开」补丁
- 隐私：删除/更换壁纸时清除 IndexedDB 中记住的本地文件授权句柄
- 供应链：`npm run bundle` 生成 `SHA256SUMS.txt`；`install.ps1` 按同 ref 校验，缺失告警跳过、不匹配中止

安装：

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

完整说明见 [README.zh.md](README.zh.md) / [README.md](README.md)，变更明细见 [CHANGELOG.md](CHANGELOG.md)。

---

## Aqua glass theme v2.1.0 — for DSH V0.2.1-rc.2

Built and verified against **DSH desktop V0.2.1-rc.2** (`engines.dsh: ">=0.2.1-rc.2 <0.3.0"`).

### Visual unification

- One page-head card contract for both host shapes: `<header class="pageHead">` (plugins page) and `<div class="pageHeading">` (automation tasks) now share a single selector group
- Page-head card spans the content column (it used to be 32px narrower); the chat header keeps its 16px gutter so it agrees with the composer
- Fixed the extra rounded box drawn inside the plugins page head (`pageHeading` is nested in `pageHead`, so both levels rendered a card)
- Seam blur now covers the gutters only — page boundary → header card top, and statistics dock bottom → page bottom. Plain `backdrop-filter`, no tint, no mask; the dock's rounded bottom edge is untouched

### Audit fixes

- Perf: three document-wide `MutationObserver`s merged into one shared, frame-coalesced DOM feed
- Compatibility: the page-head glass rule is scoped to the main column instead of every `<header>` in the document
- Behaviour: turning the theme off now releases the submenu click-hold shim
- Privacy: the remembered file handle is dropped when the wallpaper is removed or replaced
- Supply chain: `npm run bundle` writes `SHA256SUMS.txt`; `install.ps1` verifies `lib/client.js` against it (warn-and-skip when absent, abort on mismatch)

Install:

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

See [README.md](README.md) / [README.zh.md](README.zh.md) for details and [CHANGELOG.md](CHANGELOG.md) for the full list.
