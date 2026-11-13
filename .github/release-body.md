## Aqua v2.0.6 — 中文 README 成为默认，插件页开关修好了

本版没有代码改动，只修安装脚本和文档。

### 1. 中文 README 成为默认

此前 `README.md` 是英文、中文在 `README.zh.md`，所以 GitHub 首页和 npm 详情页都先显示英文。

现在互换：**`README.md` 是中文**，英文移到 `README.en.md`，顶部的语言互跳链接同步更新。npm 的 readme 取自 `README.md`，详情页随之变中文。

### 2. 插件页的开关点不动？

如果你遇到过——在插件页或插件市场里开关 Aqua 没反应，或者提示「被更高优先级配置覆盖」，市场日志里反复出现 `-> off: fiber=true`——那不是你操作错了，主题也一直是好的。

原因：Aqua 是 bundle 类插件，加载行只写在包内的 `cordis.patch.yml` 里。而 DSH 要能启用/禁用某个插件，还需要 profile 自己的 `cordis.patch.yml` 里有一条**同 id** 的行作为 patch 目标。没有这条，宿主把该条目判为 `unaddressable`：插件照常运行，但开关既写不进去，也关不掉。

现在 `install.ps1` 装完会自动补上这一条（npm 与 `-Link` 两条路径都覆盖）：

```yaml
- id: ui-aqua
  name: '@zhubai0528/dsh-client-ui-aqua-community-fix'
  disabled: false
```

- **幂等**：已有就跳过，重复执行不会多出第二条
- **不动你的禁用状态**：只在该行不存在时追加
- `name` 必须是**包名**，不是 `ui-aqua`

已经装好的用户要修，把上面三行加到 profile 的 `cordis.patch.yml` 末尾（Windows 默认 `%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml`），重启即可。重跑一次安装脚本也一样。

### 3. 顺手修掉 `-Link` 模式两个缺陷

- 读补丁文件时缺 UTF-8 声明，默认编码会把中文注释读成乱码再写回去
- 「已注册」判断会匹配插入块里的缩进行，导致明明没写 insert 却以为写过了

### 4. 文档

中英文 README 各新增一节「故障排查 / Troubleshooting」。正文没改。

### 升级

```
dsh plugin --profile desktop add @zhubai0528/dsh-client-ui-aqua-community-fix@2.0.6
```

设置照旧，无需迁移。

---

## Aqua v2.0.6 — Chinese README by default, and the Plugins-page toggle fixed

No code changes this release — the installer and the docs only.

### 1. Chinese README is now the default

`README.md` used to hold the English text (Chinese lived in `README.zh.md`), so GitHub and the npm page both opened in English.

The files are swapped: **`README.md` is Chinese**, English moved to `README.en.md`, and both language links were updated. npm takes its readme from `README.md`, so the detail page follows.

### 2. Plugins-page toggle does nothing?

If enabling or disabling Aqua from the Plugins page or the market had no effect, or the app said a higher-priority overlay wins while the market log repeated `-> off: fiber=true` — that was not a mistake on your side, and the theme itself kept running.

Cause: Aqua is a bundle plugin, so its loader row lives only in the patch file shipped inside the package. The app can only switch a plugin on or off when the profile's own `cordis.patch.yml` carries a row with the **same id** to write into. Without it the entry is reported as `unaddressable`: it runs, but the toggle neither writes nor stops it.

`install.ps1` now appends that row after a successful install (both the npm and `-Link` paths):

```yaml
- id: ui-aqua
  name: '@zhubai0528/dsh-client-ui-aqua-community-fix'
  disabled: false
```

- **Idempotent**: skipped when the row is already there
- **Leaves your disabled state alone**: only appended when missing
- `name` must be the **package name**, not `ui-aqua`

To fix an existing install, add those three lines to the end of the profile's `cordis.patch.yml` (on Windows, `%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml`) and restart. Re-running the installer does the same.

### 3. Two fixes in `-Link` mode

- reading the patch file without a UTF-8 declaration mangled its Chinese comments and wrote the mojibake back
- the "already registered" check matched indented rows inside an insert block, so a missing insert looked present

### 4. Docs

Both READMEs gained a Troubleshooting section. No other text changed.

### Upgrade

```
dsh plugin --profile desktop add @zhubai0528/dsh-client-ui-aqua-community-fix@2.0.6
```

Settings carry over; nothing to migrate.
