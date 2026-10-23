# Aqua glass theme (community-maintained fork)

English | [中文](README.zh.md)

> **Upstream notice**: this package continues from **WYH66666666**'s [DSH-Transparent-UI-Plugin](https://github.com/WYH66666666/DSH-Transparent-UI-Plugin) (published on npm as `@deepseek-ai/dsh-client-ui-aqua`) at **v1.3.0**. The original author states he cannot keep up with new DSH APIs. This fork fixes and adapts that code; it is **not guaranteed** to work with future DSH versions — back up your profile before upgrading DSH.

## Credits

| Item | Value |
|---|---|
| Original author | **WYH66666666** — [repository](https://github.com/WYH66666666/DSH-Transparent-UI-Plugin) |
| Upstream npm package | `@deepseek-ai/dsh-client-ui-aqua` |
| Base of this fork | upstream **v1.3.0** sources |
| License | MIT (inherited; original copyright and licence retained, see `LICENSE`) |
| Maintained by | this fork, versioned from **2.0.0** |

Aqua is a highly customizable glassmorphism theme for the DeepSeek Harness web UI. The header, sidebar, composer, stats line and trajectory view all become panes of frosted glass, and you can use video or images as the wallpaper. Switch it off and the stock UI comes back exactly, with no source changes to DSH itself.

![](assets/1.png)

![](assets/2.png)

![](assets/3.png)

![](assets/4.png)

## Differences from upstream v1.3.0

| Item | Upstream v1.3.0 | This package v2.0.0 |
|---|---|---|
| Layout modes | **Mica + Compatibility**, switchable | **Mica only** — compatibility mode and its selector are removed (tokens and styles too) |
| Edge blur bands | 5px gradient blur bands at the top/bottom | **Removed** (the column veil carries readability; the 13px edge fade stays) |
| Submenu opacity | not available | **New** setting, default 96%, next to "Chat surface opacity" |
| Submenu click | opens on hover, then a click closes it | **New "click keeps it open"**: a hover-opened submenu survives the click and closes on the next one; works at any depth via ARIA, keyboard unaffected |
| Popup material | `62% × frost` fill (≈8.7% by default), text behind was legible through it | **96%** fill + `blur + 4px`, panels no longer show the text behind |
| Composer and stats line | two panes with a 6px gap | **one continuous piece of glass** (single radius, hairline divider) |
| Light-mode conversation area | if the host or a skin plugin wrote the column background, the veil lost and the area went all-white; the opacity knob did nothing | **Fixed**: the veil is `!important` and also matches `[class*='centerCol']`, so it no longer depends on stamp timing |
| Scheme switching | switching to dark left the backdrop light until a knob was touched | **Fixed**: the layer watches `body[data-ds-dark-theme]` and recomputes the fluid palette, glow tone and brightness direction |
| Cold-start fluid | a GPU that was not ready permanently disabled the canvas (all-white in light mode) | **Fixed**: retried with backoff (up to 8 attempts, ~12s) |
| Published tarball | `files` omitted `cordis.patch.yml`, so installs never loaded | **Fixed**: the tarball ships `cordis.patch.yml` and `lib/*` |
| Dependency range | peer `^0.1.0-rc.5` (mismatched a 0.2.x host) | `>=0.1.0-rc.5 <0.3.0`, accepting 0.1.x and 0.2.x hosts |

## Features (current)

- **Mica layout**: header, composer, stats line and trajectory view are floating glass cards with adjustable blur and frost
- **Free backdrop**: the living fluid board (hue and depth adjustable) or your own wallpaper (its own blur and frost), video wallpapers included
- **Background brightness**: follows the resolved scheme — dark 0–50 darkens, light 50–100 brightens, 50 is unchanged
- **Chat surface opacity**: 0 lets the wallpaper/fluid show untouched, 100 is an opaque slab
- **Submenu opacity**: fill strength for popups (menus, dropdowns, quick-invoke panels), independent of the cards
- **Submenu interaction → click keeps it open**: a hover-opened submenu stays open when clicked, and closes on the next click
- **Particle whale**: the deepseek.com/harness centerpiece fish, centred in the chat area, toggleable
- **Glossy "Harness" badge**: dark mode swaps the sidebar wordmark for the official nameplate pill
- **Edge fade**: a 13px fade so content melts into the viewport edges
- One switch: off restores the stock UI exactly and removes every effect

## Installation

> `@scope` below is the npm scope this package is published under (the fork author uses `@wyh66666666`). Upstream is `@deepseek-ai/dsh-client-ui-aqua` — **do not install both**, or the profile ends up with two `ui-aqua` entries.

### Option 1: npm one-liner (recommended)

```sh
dsh plugin --profile web add @scope/dsh-client-ui-aqua
```

Installs the latest version from npm and registers it as a profile plugin layer (`dsh.bundle` patch) — works on every platform. Reload the web UI and it is on.

### Option 2: GitHub installer (fallback)

No npm account and no git needed (falls back to a plain zip download).

**Windows (one command):**

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/WYH66666666/DSH-Transparent-UI-Plugin/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

Installs the **latest release** by default; the script links the plugin into the profile's `node_modules` and registers `ui-aqua` in `cordis.patch.yml` (idempotent).

### Option 3: manual (macOS / Linux)

```sh
git clone --depth 1 https://github.com/WYH66666666/DSH-Transparent-UI-Plugin.git
ln -s "$PWD/DSH-Transparent-UI-Plugin" "$DSH_HOME/profiles/web/node_modules/@scope/dsh-client-ui-aqua"
```

then append to `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: ui-aqua
      name: '@scope/dsh-client-ui-aqua'
```

## Usage

Reload the web UI. Aqua is **on by default**; the master switch sits at the top of the **Glass theme** panel. Panel groups, top to bottom:

`Glass material` (blur, frost) → `Backdrop` (fluid/wallpaper, hue, depth, brightness, chat-surface opacity, submenu opacity) → `Ambient` → `Hover effects` → `Submenu interaction`

> The upstream **Mode** group (Mica / Compatibility) is gone in 2.0.0.

## Upgrading from upstream 1.x

- `dsh.ui-aqua.mode` is no longer read: users who picked Compatibility land on the mica layout (the stored value is left untouched, not destroyed)
- Every other setting keeps its key (blur, frost, hue, depth, brightness, chat-surface opacity …) and carries over untouched
- The package name differs — uninstall the old package first so two `ui-aqua` entries never coexist
