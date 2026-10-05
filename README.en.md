# luci-app-ledcontrol

[简体中文](README.md) | **English**

A small LuCI application for OpenWrt / ImmortalWrt that controls the **device
status LEDs** and the **network port LEDs** with two independent toggles, and
keeps the chosen combination across reboots.

* LuCI 2 (client side JavaScript) - no legacy Lua CBI views.
* The interface is English; Simplified Chinese ships as a separate
  `luci-i18n-ledcontrol-zh-cn` package, released alongside the main one.
* Supports both package formats: `.ipk` (opkg, OpenWrt 24.10) and `.apk`
  (apk-openssl, OpenWrt 25.12+).

## How it works

The package is made of three parts:

| Component | Path | Purpose |
| --- | --- | --- |
| UCI config | `/etc/config/ledcontrol` | Stores the two toggles (`1` = on, `0` = off). |
| init script | `/etc/init.d/ledcontrol` | Writes the stored state to the LEDs at boot (`START=99`). |
| LuCI view | `view/ledcontrol.js` | Renders the two toggles and applies changes immediately. |

Pressing **Save & Apply** commits the UCI change and then restarts the init
script, so the LEDs change state right away - no reboot needed. The init script
runs again on every boot, so the setting survives a reboot.

What the two toggles do:

| Status LEDs | Port LEDs | Result |
| --- | --- | --- |
| on | on | everything lit |
| on | off | only the status LEDs lit |
| off | on | only the port LEDs lit |
| off | off | everything dark |

**How a LED is classified**: a LED whose name - the directory name below
`/sys/class/leds/` - contains `wan`, `lan`, `port`, `eth`, `sw` or `gphy` is a
**network port LED**; every other one (power, Wi-Fi, USB, ...) is a **status
LED**. Wi-Fi LEDs (names containing `wlan`) count as status LEDs.

Each LED is written the value of the toggle that owns it: "on" writes the LED's
own `max_brightness`, "off" writes `0`. See
[Implementation notes](#implementation-notes) for why.

### Upgrading from 1.0.x

1.0.x had a single `ledcontrol.global.enable` toggle. On upgrade,
`/etc/uci-defaults/luci-app-ledcontrol` copies its value into both new toggles
and removes the obsolete option, so the state you last chose survives. The init
script also treats the old option as a fallback for both new toggles while it is
still present - after restoring a 1.0.x configuration backup, for instance.

## Implementation notes

- **"On" writes the LED's own `max_brightness`, not a hard coded `1`.**
  `brightness` is a range of `0 … max_brightness`: a plain GPIO LED has `1`
  (exactly equivalent to writing `1`), while a PWM or RGB LED typically has
  `255`, where writing `1` is 1/255 of the range - visually off.
- **"Off" is always a literal `0`.** Writing 0 is what makes the kernel detach
  the LED's trigger, so a LED that was switched off is not lit up again by a
  `timer`, `heartbeat` or similar trigger. Writing a non-zero value leaves the
  trigger alone, so "on" means **let the LED resume its normal behaviour**
  rather than force it steady. Because switching off detaches the trigger, an
  off/on cycle does not bring it back; **a reboot does**.
- **The Wi-Fi test comes before the keyword test and wins.** `wlan` contains
  `lan`, so otherwise Wi-Fi LEDs would be swept into the port group. The same
  goes for the Wi-Fi PHY LEDs such as `ath9k-phy0` - which is why the port
  keyword is `gphy` and not the bare `phy`.
- **The keyword test uses POSIX `case` patterns**, not the bash
  `[[ "$i" =~ "wan" ]]` operator: `/bin/sh` on OpenWrt and ImmortalWrt is
  busybox ash, which supports **neither `[[ ]]` nor `=~`**. Written in bash
  syntax the init script would fail with a syntax error on every boot and apply
  nothing.

## Installation

Download the matching package from the [Releases](../../releases) page, copy it
to the router and install it.

Packages are built for OpenWrt 24.10 (`.ipk`) and 25.12+ (`.apk`). The release
tag and name are read straight from `PKG_VERSION`/`PKG_RELEASE` in the Makefile
(`1.0.2-r1`, say), so the version you download always matches the tag.

The main package carries the English interface only:

```sh
# OpenWrt 24.10 and older (opkg)
opkg install luci-app-ledcontrol_*.ipk

# OpenWrt 25.12 and newer (apk)
apk add --allow-untrusted luci-app-ledcontrol-*.apk
```

For Simplified Chinese, install the language package from the same release:

```sh
# OpenWrt 24.10 and older (opkg)
opkg install luci-i18n-ledcontrol-zh-cn_*.ipk

# OpenWrt 25.12 and newer (apk)
apk add --allow-untrusted luci-i18n-ledcontrol-zh-cn-*.apk
```

Once it is installed, 简体中文 appears in LuCI's **System → Language and Style**;
with the language left at the default `auto`, a Chinese browser language selects
it automatically.

Then open **System → LED Control** in LuCI.

## Command line

```sh
# status LEDs off, network port LEDs kept on
uci set ledcontrol.global.status_leds='0'
uci set ledcontrol.global.net_leds='1'
uci commit ledcontrol
/etc/init.d/ledcontrol restart
```

## Building

### With the OpenWrt SDK

```sh
# inside an unpacked SDK
mkdir -p package/luci-app-ledcontrol
rsync -a --exclude .git ./ package/luci-app-ledcontrol/
./scripts/feeds update -a
./scripts/feeds install -a
# Select Simplified Chinese explicitly. The translation package's DEFAULT is
# LUCI_LANG_zh_Hans||(ALL&&m) and the SDK does not set CONFIG_ALL, so without
# this line the language package is never built.
echo "CONFIG_LUCI_LANG_zh_Hans=y" >> .config
make defconfig
make package/luci-app-ledcontrol/compile V=s
```

Two packages appear below `bin/packages/<arch>/base/`:
`luci-app-ledcontrol_*.ipk` and `luci-i18n-ledcontrol-zh-cn_*.ipk` (same for
`.apk`).

### With GitHub Actions

`.github/workflows/build.yml` builds the package against the official SDKs of
OpenWrt **24.10.8** (`.ipk`) and **25.12.5** (`.apk`) in a matrix and uploads
the built packages as artifacts. It runs on every push, pull request and manual
dispatch.

Before compiling it runs a `test` job: `node tests/i18n.test.js` plus syntax
checks (`node --check`, `sh -n`). It takes seconds, but it catches the kind of
change that would otherwise only show up as a page that is silently still in
English - a string edited in the view without the matching `po` entry. `build`
depends on it, so a failing test stops the build.

On a push it also publishes the packages to the Releases page, taking both the
tag and the release name from `PKG_VERSION`/`PKG_RELEASE` in the Makefile. The
version therefore has a single source of truth and cannot drift from the tag.
Pull requests build only - they never publish.

## Repository layout

```
luci-app-ledcontrol/
├── Makefile
├── LICENSE
├── htdocs/luci-static/resources/view/ledcontrol.js
├── po/
│   ├── templates/ledcontrol.pot
│   └── zh_Hans/ledcontrol.po
├── tests/i18n.test.js
├── root/
│   ├── etc/
│   │   ├── config/ledcontrol
│   │   ├── init.d/ledcontrol
│   │   └── uci-defaults/luci-app-ledcontrol
│   └── usr/share/
│       ├── luci/menu.d/luci-app-ledcontrol.json
│       └── rpcd/acl.d/luci-app-ledcontrol.json
└── .github/workflows/build.yml
```

The `menu.d` and `acl.d` files are what actually make the page reachable: the
first registers the *System → LED Control* entry, the second grants the view
read/write access to the `ledcontrol` UCI config and permission to call
`rc init`.

The `zh_Hans` directory name under `po/` is what decides which language package
luci.mk emits: it generates a `luci-i18n-*` package per directory below `po/`,
but only for names that appear in its built-in language table (`LUCI_LANG.*` in
`luci.mk`). `zh_Hans` is in that table, so the directory yields
`luci-i18n-ledcontrol-zh-cn`.

The compiled catalog is named `ledcontrol.zh-cn.lmo` rather than
`ledcontrol.zh_Hans.lmo`, because the table's `LUCI_LC_ALIAS.zh_Hans=zh-cn`
supplies the tag LuCI uses for the compiled catalog. That name is load bearing:
the ucode dispatcher loads every `*.zh-cn.lmo` in `/usr/lib/lua/luci/i18n/`.

English needs no file at all: when no translation matches, `_()` returns the
msgid unchanged, so the English strings in `ledcontrol.js` are their own
translation.

`tests/i18n.test.js` is the regression test for this chain
(`node tests/i18n.test.js`). It asserts that every `_()` literal in the view has
a msgid in the `po`, that the `po` has no orphans, that no msgid carries
surrounding whitespace and that none contains an escape `po2lmo` does not
handle. Each of those failures makes the interface fall back to English
**silently**, which is why the assertions are worth keeping in CI.

## License

GNU General Public License v3.0 (GPL-3.0-only) - see [LICENSE](LICENSE).
