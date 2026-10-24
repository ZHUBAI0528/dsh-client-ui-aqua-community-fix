## Aqua 玻璃主题 v2.0.2 — 适配 DSH V0.2.1-rc.3

**主体代码零改动。** rc.3 的客户端接口与 rc.2 一致 —— 换成 rc.3 的类型定义后 `tsc --noEmit` 零错误，不需要任何适配补丁。本版只更新版本声明、重算产物、修掉安装脚本的默认行为。

### 宿主版本对齐 rc.3

| 项 | 从 | 到 |
|---|---|---|
| `engines.dsh` | `>=0.2.1-rc.2 <0.3.0` | `>=0.2.1-rc.3 <0.3.0` |
| peer：locale / primitives / slots / theme | `>=0.2.1-rc.2 <0.3.0` | `>=0.2.1-rc.3 <0.3.0` |
| peer：runtime / invariants | `>=0.2.1-rc.2 <0.3.0` | `>=0.1.0-rc.5 <0.3.0` |
| devDependencies（上述 4 个包） | `^0.1.0-rc.5` / `0.2.1-rc.2` | `0.2.1-rc.3` |
| `tsdown` / `@tsdown/css` | `^0.23.1` | `0.23.1`（钉死，避免产物漂移） |

`dsh-client-runtime` 与 `dsh-invariants` **没有 rc.3 版本** —— 它们走独立的 0.1.x 版本线，宿主 asar 内也不单独携带（只作类型来源，编译后擦除）。此前给这两个包写的 `>=0.2.1-rc.2` 是永远无法满足的声明，本版一并纠正。

### 产物

`lib/client.js` 252674 → **252210** 字节，摘要 `9eb677a8…` → `e7ee93c1…`。逐字节核对过差异，只有两类，均不影响逻辑：

- 24 处打包器区域注释 `//#region …` → `//`（构建工具输出格式差异）
- 2 处 CSS 内联字符串换行符 `CRLF` → `LF`

图标导出名（`IconCheckOutlineRegular` / `IconSparkleRegular`）、运行时 `require` 列表、全部 CSS 规则内容均未变。

### 安装脚本

`install.ps1` **默认改为从 npm 安装**，junction 方式降级为显式的 `-Link`（仅供开发调试）。原脚本只做源码链接，而 junction 会让应用的文件操作落到源码目录里，并且从此阻止同名 npm 包安装（`ERR_PNPM_EPERM`，pnpm 无法 rename 覆盖跨卷重解析点）。

同时修掉三个 bug：junction 路径写错（`profiles\node_modules` → `profiles\<profile>\node_modules`）、`-DshHome` 未透传给 CLI、默认 `latest` 会装到旧版（pnpm `minimumReleaseAge` 所致，现改为先读 dist-tag 再 pin）。安装前自动清理遗留 junction，只删链接、不跟随目标。

详见 [CHANGELOG.md](CHANGELOG.md)。

### 安装

桌面版（推荐）：打开 **DeepSeek Harness V0.2.1-rc.3** → 左侧栏 **插件** → **添加插件** → 在「包名或地址」中填入：

```
github:zhubai0528/dsh-client-ui-aqua-community-fix
```

已发布到 npm（`@zhubai0528/dsh-client-ui-aqua-community-fix@2.0.2`，公开访问），命令行一条搞定：

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

Windows 也可用一键脚本（默认从 npm 安装，会先清理遗留 junction）：

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

完整说明见 [README.zh.md](README.zh.md) / [README.md](README.md)。

---

## Aqua glass theme v2.0.2 — for DSH V0.2.1-rc.3

**Application code is unchanged.** The rc.3 client surfaces match rc.2 — pointing the build at rc.3 typings gives zero `tsc --noEmit` errors, so no compatibility patch was needed. This release updates the version declarations, rebuilds the artifact, and fixes the installer's default behaviour.

### Host alignment

| Item | From | To |
|---|---|---|
| `engines.dsh` | `>=0.2.1-rc.2 <0.3.0` | `>=0.2.1-rc.3 <0.3.0` |
| peer: locale / primitives / slots / theme | `>=0.2.1-rc.2 <0.3.0` | `>=0.2.1-rc.3 <0.3.0` |
| peer: runtime / invariants | `>=0.2.1-rc.2 <0.3.0` | `>=0.1.0-rc.5 <0.3.0` |
| devDependencies (those four) | `^0.1.0-rc.5` / `0.2.1-rc.2` | `0.2.1-rc.3` |
| `tsdown` / `@tsdown/css` | `^0.23.1` | `0.23.1` (pinned, so the artifact stops drifting) |

`dsh-client-runtime` and `dsh-invariants` **have no rc.3** — they follow an independent 0.1.x line and are not shipped as standalone packages inside the host asar (type source only, erased at build time). The previous `>=0.2.1-rc.2` for those two was a declaration that could never be satisfied; corrected here.

### Artifact

`lib/client.js` goes from 252674 to **252210** bytes, digest `9eb677a8…` → `e7ee93c1…`. The diff was checked byte by byte: two classes only, neither affecting logic.

- 24 bundler region comments `//#region …` → `//`
- 2 line endings inside the inlined CSS string, `CRLF` → `LF`

Glyph names (`IconCheckOutlineRegular` / `IconSparkleRegular`), the runtime `require` list, and every CSS rule are unchanged.

### Installer

`install.ps1` now **installs from npm by default**; the junction path is demoted to an explicit `-Link` flag for development only. A junction puts the app's file operations inside the source tree and permanently blocks the npm install of the same package (`ERR_PNPM_EPERM` — pnpm cannot rename over a cross-volume reparse point).

Three bugs fixed along the way: the junction path was wrong (`profiles\node_modules` instead of `profiles\<profile>\node_modules`), `-DshHome` was not exported to the CLI, and a bare `latest` resolved to an older version (pnpm's `minimumReleaseAge`; it now reads the dist-tag and pins it). Stale junctions are cleared first — link only, never the target.

See [CHANGELOG.md](CHANGELOG.md) for details.

### Install

Desktop app (recommended): open **DeepSeek Harness V0.2.1-rc.3** → **Plugins** in the left sidebar → **Add plugin** → enter:

```
github:zhubai0528/dsh-client-ui-aqua-community-fix
```

Published to npm (`@zhubai0528/dsh-client-ui-aqua-community-fix@2.0.2`, public), so one command does it:

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

On Windows the one-shot script works too (installs from npm, clears stale junctions first):

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

See [README.md](README.md) / [README.zh.md](README.zh.md) for details.
