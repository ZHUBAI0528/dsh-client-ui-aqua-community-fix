## Aqua 玻璃主题 v2.1.1 — 类型收敛补丁（适配 DSH V0.2.1-rc.2）

**运行时行为与 2.1.0 等价**，本版只做三件事：把 `tsc --noEmit` 从 14 条清零、把图标名对齐到宿主真实可解析的名字、清掉三个未使用的依赖。

### 关键更正：图标名以宿主运行时为准

开发依赖原本解析到 `primitives@0.1.0-rc.8`，该版本把图标改名成了 `16` 后缀（`IconCheckOutline16` / `IconSparkle16`）。而宿主 **DSH V0.2.1-rc.2** 运行时只解析 `IconCheckOutlineRegular` / `IconSparkleRegular`。

取证（扫描宿主 `app.asar`）：`·Regular` 命中 **18 次**，分布在 13 个官方 UI 插件与前端 bundle；`·16` 命中 **0 次**。

因此**按类型声明去改源码会让面板白屏**（`jsx(undefined)`）。本版把开发依赖钉到宿主同版 `0.2.1-rc.2`，源码保持运行时真实名字，peer 范围同步收紧为 `>=0.2.1-rc.2 <0.3.0` —— 宽范围会同时放行两版，而两版图标名互不兼容，等于允许装出一个白屏组合。

### 类型修复

- `@deepseek-ai/dsh-client-store`（平台种子词）：声明文件原把 `export function` 写在顶层，说明符始终解析不到；改为整体包进 `declare module`，形状与宿主 `StoreSpec` / `StoreHandle` / `StoreInstance` 逐成员一致
- 槽位契约：新增 `src/slot-contract.d.ts`，向 `SlotMap` 合并 `sidebar.panellist`（root list）与 `main`（root keyed），形状取自宿主自带文档
- `FileSystemHandle.queryPermission` / `requestPermission`：新增 `src/fs-access.d.ts`（Chromium 已提供，TypeScript 的 `lib.dom` 未收录）
- 面板页 props 移除多余的 actions 契约；`showOpenFilePicker` 绑定局部变量并判空

### 依赖清理

移除 `dsh-client-ui-settings`、`dsh-client-ui-settings-plugins`（源码零引用）与 `dsh-client-test-runtime`（本仓库无测试脚本）。

### 产物

`lib/client.js` 相对 2.1.0 净差 **6 增 3 删**，全部落在 picker 判空处；图标名、模块 `require`、CSS 完全一致。

安装：

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

完整说明见 [README.zh.md](README.zh.md) / [README.md](README.md)，变更明细见 [CHANGELOG.md](CHANGELOG.md)。

---

## Aqua glass theme v2.1.1 — type-convergence patch (for DSH V0.2.1-rc.2)

**Runtime behaviour is equivalent to 2.1.0.** This release does three things: clears all 14 `tsc --noEmit` errors, aligns the glyph names to the ones the host actually resolves, and drops three unused dependencies.

### Correction: glyph names follow the host runtime

The dev dependency resolved to `primitives@0.1.0-rc.8`, which renamed the glyphs to a `16` suffix (`IconCheckOutline16` / `IconSparkle16`). The host — **DSH V0.2.1-rc.2** — resolves only `IconCheckOutlineRegular` / `IconSparkleRegular`.

Evidence (scanning the host `app.asar`): the `Regular` names occur **18 times** across 13 shipped UI plugins and the frontend bundle; the `16` names occur **0 times**.

Editing the source to match the typings would therefore render `jsx(undefined)` and blank the panel. This release pins the dev dependency to the host's own `0.2.1-rc.2`, keeps the runtime names in source, and tightens the peer range to `>=0.2.1-rc.2 <0.3.0` — the wide range admitted both versions, whose glyph names are mutually incompatible.

### Type fixes

- `@deepseek-ai/dsh-client-store` (platform seed word): the ambient file declared `export function` at the top level, so the specifier never resolved; the surface now lives inside `declare module` and mirrors the host's `StoreSpec` / `StoreHandle` / `StoreInstance` member for member
- Slot contracts: new `src/slot-contract.d.ts` augments `SlotMap` with `sidebar.panellist` (root list) and `main` (root keyed), shapes taken from the host's own docs
- `FileSystemHandle.queryPermission` / `requestPermission`: new `src/fs-access.d.ts` (shipped by Chromium, missing from `lib.dom`)
- The panel page no longer requires the store's baked actions; `showOpenFilePicker` is bound to a local and null-checked

### Dependency cleanup

Removed `dsh-client-ui-settings`, `dsh-client-ui-settings-plugins` (zero source references) and `dsh-client-test-runtime` (this repo has no test script).

### Artifact

`lib/client.js` differs from 2.1.0 by **6 added / 3 removed** lines, all in the picker guard; glyph names, module `require`s and CSS are unchanged.

Install:

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

See [README.md](README.md) / [README.zh.md](README.zh.md) for details and [CHANGELOG.md](CHANGELOG.md) for the full list.
