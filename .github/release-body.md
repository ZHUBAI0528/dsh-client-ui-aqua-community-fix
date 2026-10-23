## Aqua 玻璃主题 v2.0.0

首次以 `@zhubai0528/dsh-client-ui-aqua` 独立发布。

- 仅云母布局：兼容模式与「模式」切换整体移除
- 移除上下渐变模糊带（13px 边缘淡出保留）
- 新增「子菜单不透明度」（默认 96%）与「子菜单交互 → 点击保持展开」
- 修复：浅色模式会话区整片发白 / 深色模式不跟随 / 冷启动流体不绘制 / 输入框与状态栏 6px 缝隙
- 发布包补齐 `cordis.patch.yml`；peer 依赖范围放宽到 `>=0.1.0-rc.5 <0.3.0`
- 许可对齐为 AGPL-3.0（沿用上游 `LICENSE`）

安装：

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua
```

完整说明见 [README.zh.md](README.zh.md) / [README.md](README.md)，变更明细见 [CHANGELOG.md](CHANGELOG.md)。

---

## Aqua glass theme v2.0.0

First stand-alone release under `@zhubai0528/dsh-client-ui-aqua`.

- Mica layout only: compatibility mode and the mode switch are gone
- Removed the top/bottom gradient blur bands (the 13px edge fade stays)
- New `Submenu opacity` (default 96%) and `Submenu interaction → click keeps it open`
- Fixed: light-mode chat area going all-white / dark mode not following / cold-start fluid never drawing / the 6px gap between composer and stats line
- The tarball now ships `cordis.patch.yml`; the peer range widens to `>=0.1.0-rc.5 <0.3.0`
- Licence aligned to AGPL-3.0 (inherited from upstream `LICENSE`)

Install:

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua
```

See [README.md](README.md) / [README.zh.md](README.zh.md) for details and [CHANGELOG.md](CHANGELOG.md) for the full list.
