# Aqua 玻璃主题（社区维护版）

[English](README.md) | 中文

> **上游说明**：本包基于原作者 **WYH66666666** 的 [DSH-Transparent-UI-Plugin](https://github.com/WYH66666666/DSH-Transparent-UI-Plugin)（npm 上的 `dsh-client-ui-aqua`）**v1.3.0** 源码继续维护。原作者声明因学业繁忙无法及时适配 DSH 新 API，本版本在其基础上修复与适配，**不保证**与未来 DSH 版本兼容——升级 DSH 前请先备份 profile。

## 支持的 DSH 版本

| 项 | 内容 |
|---|---|
| **DSH 桌面端 / 网页端** | **V0.2.1-rc.2** |
| 宿主客户端包 | `@deepseek-ai/dsh-client-*` **0.2.1-rc.2** |
| 元数据声明 | `package.json` → `engines.dsh: ">=0.2.1-rc.2 <0.3.0"` |

**V0.2.1-rc.2 是本版本构建与验证所依据的版本** —— 主题所依赖的挂载点取自该版本宿主（页头标记、输入区与统计栏接缝、插槽名）。这些都是宿主的内部客户端接口，因此升级 DSH 有可能在不改动本插件的情况下导致外观或挂载异常。使用其它 DSH 版本时请视为不受支持，并保留 profile 备份。

## 标签与社区收录

仓库已打上 `dsh-plugin` 标签，会出现在 [dsh-plugin 社区主题页](https://github.com/topics/dsh-plugin)，与其它 DeepSeek Harness 插件并列。

`dsh-plugin` · `dsh` · `deepseek-harness` · `deepseek-harness-plugin` · `theme` · `glassmorphism` · `aqua`

## 来源与致谢

| 项 | 内容 |
|---|---|
| 原作者 | **WYH66666666** — [仓库](https://github.com/WYH66666666/DSH-Transparent-UI-Plugin) |
| 上游 npm 包 | `dsh-client-ui-aqua`（最新 1.3.1） |
| 本包基线 | 上游 **v1.3.0** 源码 |
| 本包维护 | **ZHUBAI0528** — [仓库](https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix) |
| 本包 npm 包名 | `@zhubai0528/dsh-client-ui-aqua-community-fix` |
| 本包版本 | **2.0.0** |
| **DSH 支持版本** | **V0.2.1-rc.2** |
| 许可 | **AGPL-3.0**（沿用上游 `LICENSE`，原版权与许可声明完整保留） |

Aqua 是一层高自由度的玻璃质感主题，套在 DeepSeek Harness 网页端与桌面端。顶栏、输入框与状态栏、轨迹视图等区域成为磨砂玻璃片，主内容区背后可以是流体板，也可以是自定义壁纸（图片或视频）；侧边栏保持原生外观。关掉开关就回到原生界面，不改 DSH 任何一行源码。

![](assets/1.png)

![](assets/2.png)

![](assets/3.png)

![](assets/4.png)

## 与上游 v1.3.0 的差异

| 项 | 上游 v1.3.0 | 本包 v2.0.0 |
|---|---|---|
| 布局模式 | **云母 + 兼容** 双模式，可切换 | **仅云母**：兼容模式与其切换入口整体移除（含底层 token 与样式） |
| 边缘渐变模糊带 | 顶部/底部 5px 渐变模糊带（上游特性） | **已移除**：读取时会被误看成一层额外渐变wash；可读性改由主列 veil 承担（13px 极窄边缘淡出保留） |
| 子菜单不透明度 | 无该档位 | **新增**，默认 96%，与「会话区不透明度」同组 |
| 子菜单点击行为 | 悬停展开，随后点击会立刻收起 | **新增「点击保持展开」**：悬停展开后点击保持、再点收起；按 ARIA 契约逐级生效，键盘 Enter 不受影响 |
| 弹层材质 | 填充 `62% × 磨砂`（默认约 8.7%），易与正文叠字 | 填充 **96%** + `玻璃模糊度 + 4px`，面板不再透出后方文字 |
| 输入框与状态栏 | 两块玻璃，中间 6px 缝隙 | **合并为一块连续玻璃**（单一圆角、细线分隔） |
| 浅色模式会话区 | 列的 background 被宿主/皮肤插件覆盖时 veil 失效 → 整片白、会话区不透明度滑杆无效 | **已修复**：veil 用 `!important` 并同时匹配 `[class*='centerCol']`，不再依赖盖章时机 |
| 深浅模式切换 | 切到深色后背景不跟随，需手动重调参数 | **已修复**：监听 `body[data-ds-dark-theme]`，自动重算流体调色板、辉光色与亮度叠加方向 |
| 冷启动流体 | GPU 未就绪时流体永久不绘制（浅色下表现为整片白） | **已修复**：退避重试（最多 8 次，约 12s） |
| 发布包内容 | `files` 未含 `cordis.patch.yml`，安装后插件不加载 | **已修复**：tarball 含 `cordis.patch.yml` 与 `lib/*` |
| 依赖范围 | peer `^0.1.0-rc.5`（与 0.2.x 宿主不符） | `>=0.2.1-rc.2 <0.3.0`，与本主题所依据的宿主版本线绑定 |
| 许可声明 | 仓库 `LICENSE` 为 AGPL-3.0，`package.json` 却写 MIT | **已对齐**：统一声明 AGPL-3.0，不再自相矛盾 |

## 特性（当前版本）

- **云母玻璃布局**：顶栏、输入框、状态栏、轨迹视图为悬浮玻璃，模糊度与磨砂度可调
- **主题控制面板**：颜色、壁纸、不透明度、模糊度等参数集中在一页，不必各处翻找
- **输入框取消 3D 效果**：3D 立体效果已移除，避免影响字体显示
- **背景自由**：流体板（色调、颜色深浅可调）或自定义壁纸，图片与视频都支持；壁纸可单独调节模糊度、磨砂度，视频另有亮度档
- **跟随桌面端深浅模式**：自动适配桌面端浅色/深色切换，同步重算调色板、辉光与亮度方向
- **背景亮度**：自动跟随深浅模式——深色 0–50 压暗、浅色 50–100 提亮，50 原样
- **会话区不透明度**：0 让壁纸/流体原样透出，100 为不透明底板
- **子菜单不透明度**：弹层（菜单、下拉、快速调用面板）的填充强度，独立于卡片
- **子菜单显示优化**：弹层填充提升至 96% 并叠加模糊，多级菜单始终清晰浮于正文之上
- **子菜单交互 → 点击保持展开**：悬停展开的子菜单在被点击时保持展开，再点一次收起
- **环境装饰**：粒子鲸鱼（deepseek.com/harness 同款）、小鱼、网状交互，可分别开关
- **悬停效果 → 鼠标辉光**：指针附近的高光跟随
- **Harness 光泽铭牌**：深色模式侧边栏铭牌换成官网同款药丸，浅色保持原版
- **边缘淡出**：13px 极窄边缘淡出，内容滚到边缘自然融入
- 一键开关：关闭即完全还原原生界面，所有效果随插件卸载一并消失

## 安装

> 上游包 `dsh-client-ui-aqua` 与本包 `@zhubai0528/dsh-client-ui-aqua-community-fix` **不要同时安装**，否则 profile 里会出现两个 `ui-aqua` 条目。

### 方式一：桌面版 — 应用内插件页安装（推荐）

打开 **DeepSeek Harness 0.2.1-rc.2**，点击左侧栏的 **插件**。

点击 **添加插件**，在「包名或地址」中填入：

```
github:zhubai0528/dsh-client-ui-aqua-community-fix
```

无需 npm、无需命令行，插件会从该 GitHub 仓库取用最新发布版。装完刷新界面即可生效。

### 方式二：GitHub 安装器（备用）

不需要 npm、不需要 git（自动退回 zip 下载）。

**Windows（一条命令）：**

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

默认安装**最新发布版**。脚本会把插件链接进 profile 的 `node_modules`，并在 `cordis.patch.yml` 里登记 `ui-aqua`（幂等，重复运行不会重复登记）。

> ⚠️ **用本方式装过之后，想改从 npm 安装，必须先删掉 junction。** 脚本会在 `node_modules\@zhubai0528\dsh-client-ui-aqua-community-fix` 创建一个**目录联接**（junction）指向源码目录。只要它还在，无论从插件页还是 `dsh plugin add` 安装同一个 npm 包都会失败：
>
> ```
> [ERR_PNPM_EPERM] [importPackage ...] rename ... EPERM: operation not permitted
> ```
>
> 原因是 pnpm 无法用真实目录替换一个指向其它卷的重解析点。先删链接（**只删链接，不碰源码**）：
>
> ```powershell
> cmd /c rmdir "%USERPROFILE%\.dsh\profiles\desktop\node_modules\@zhubai0528\dsh-client-ui-aqua-community-fix"
> ```
>
> 不要用 `Remove-Item -Recurse` —— 旧版 PowerShell 会跟进目标目录，把源码删掉。

### 方式三：npm

```sh
dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
```

从 npm 安装最新版，自动注册为 profile 插件层（`dsh.bundle` 补丁），所有平台通用。刷新界面即可生效。

包的 npm 页面：<https://www.npmjs.com/package/@zhubai0528/dsh-client-ui-aqua-community-fix>

> 需要本机已装 Node.js 与 npm。若访问 npm 官方源较慢，可临时指定镜像安装；注意镜像的同步有延迟，刚发布的版本可能尚未同步。

### 方式四：手动（macOS / Linux）

```sh
git clone --depth 1 https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix.git
ln -s "$PWD/dsh-client-ui-aqua-community-fix" "$DSH_HOME/profiles/web/node_modules/@zhubai0528/dsh-client-ui-aqua-community-fix"
```

然后往 `$DSH_HOME/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: ui-aqua
      name: '@zhubai0528/dsh-client-ui-aqua-community-fix'
```

## 使用

刷新界面。Aqua **默认开启**，总开关在左侧边栏的 **玻璃主题** 页面顶部（它是独立页面，不在「插件/设置」标签里）。面板分组自上而下为：

`玻璃材质`（玻璃模糊度、磨砂度）→ `背景`（流体/壁纸、色调、颜色深浅、背景亮度、会话区不透明度、子菜单不透明度）→ `环境装饰`（粒子鲸鱼、小鱼、网状交互）→ `子菜单交互`（点击保持展开）→ `悬停效果`（鼠标辉光）

> 上游的「模式」分组（云母效果 / 兼容模式）在 2.0.0 已整体移除。

## 背景与视觉调节

背景有流体与壁纸两种来源，由设置面板顶部的分段控件切换，**默认流体**。所有数值项统一为「滑块 + 数字输入框」双联动：拖动即时生效，数字框可直接键入精确值，越界自动收敛到边界；设置持久化在本地，刷新后保留。

**流体板（默认）** 是实时流动的渐变，由两个旋钮控制：「色调」0–360° 定色相（默认 320°，偏紫红），「颜色深浅」0–100% 定浓度（默认 25%）。

**图片壁纸与视频壁纸** 用「选择图片」「选择视频」上传。任一按钮选定文件后，背景来源会**自动切换到壁纸**，不必再手动拨分段控件。图片接受浏览器可解码的常见格式（PNG、JPG、WebP 等）；视频接受 MP4、WebM、Ogg、QuickTime。已有壁纸时面板出现「删除壁纸」，用于清空回纯流体。

两类壁纸的可调项不同：图片壁纸可调「壁纸模糊度」与「壁纸磨砂度」；视频壁纸可调「视频模糊度」与「视频亮度」——视频没有独立的磨砂层，改由亮度配合自动压暗来保证可读性。

### 参数一览

| 设置项 | 适用 | 范围 | 步进 | 默认 |
|---|---|---|---|---|
| 背景来源 | 全部 | 流体 / 壁纸 | — | 流体 |
| 色调 | 流体 | 0–360° | 1° | 320° |
| 颜色深浅 | 流体 | 0–100% | 1% | 25% |
| 壁纸模糊度 | 图片 | 0–40 px | 0.5 px | 0 |
| 壁纸磨砂度 | 图片 | 0–100% | 1% | 0 |
| 视频模糊度 | 视频 | 0–40 px | 0.5 px | 6 px |
| 视频亮度 | 视频 | 0–100% | 1% | 45% |
| 玻璃模糊度 | 全部 | 0–40 px | 0.5 px | 20 px |
| 磨砂度 | 全部 | 0–100% | 1% | 7% |
| 背景亮度 | 全部 | 深色 0–50 / 浅色 50–100 | 1% | 50 |
| 会话区不透明度 | 全部 | 0–100% | 1% | 25% |
| 子菜单不透明度 | 全部 | 0–100% | 1% | 96% |

「背景亮度」的取值范围随明暗模式自动切换：深色模式只开放 0–50（0 压至纯黑，50 原样），浅色模式只开放 50–100（50 原样，100 提亮至纯白）；另一半区间不可达，所以两个模式下的选择互不影响。

「会话区不透明度」为 0 时壁纸/流体原样透出，100 时是完全不透明的底板。「子菜单不透明度」单独一档，因为弹层浮在正文与输入框文字之上，需要比卡片更实的底色。

### 使用须知

1. **视频会被自动压暗** —— 为保证前景文字清晰，视频壁纸默认叠加压暗且不可关闭，但可用「视频亮度」「视频模糊度」在此基础上前调。
2. **刷新后视频可能不自动播放** —— 浏览器对本地视频重放有授权限制；此时再点一次「选择视频」即可恢复，无需重新选文件。
3. **壁纸要与明暗模式匹配** —— 浅色壁纸配浅色模式、深色壁纸配深色模式，否则文字对比度会下降；面板内已就此提示。

## 从上游 1.x 升级

- `dsh.ui-aqua.mode` 不再被读取：此前选过「兼容模式」的用户会直接落到云母布局（键值保留，不会被清除）
- 其余参数（模糊、磨砂、色调、深浅、亮度、会话区不透明度等）键名不变，会原样沿用
- 包名不同，升级前请先卸载旧包，避免同时登记两个 `ui-aqua`

## 本地开发

```sh
npm install
npm run bundle      # 构建 lib/（tsdown → 内联 CSS → ESM→CJS 兼容层）
npm run watch       # 监听构建
```

发布前用 `powershell -ExecutionPolicy Bypass -File .\publish.ps1 -DryRun` 检查 tarball 内容，去掉 `-DryRun` 即正式发布。

## 许可

[AGPL-3.0](LICENSE)，沿用上游许可。原作者的版权与许可声明完整保留。
