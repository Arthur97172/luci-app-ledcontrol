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

## Installation

Download the matching package from the [Releases](../../releases) page, copy it
to the router and install it.

Packages are built for OpenWrt 24.10 (`.ipk`) and 25.12+ (`.apk`). The release
tag and name are read straight from `PKG_VERSION`/`PKG_RELEASE` in the Makefile
(`1.0.2-r1`, say), so the version you download always matches the tag.

The main package carries the English interface only:
For Simplified Chinese, install the language package from the same release:

```sh
# OpenWrt 24.10 and older (opkg)
opkg install luci-app-ledcontrol_*.ipk
# Chinese UI needs the translation package as well
opkg install luci-i18n-ledcontrol-zh-cn_*.ipk

# OpenWrt 25.12 and newer (apk)
apk add --allow-untrusted luci-app-ledcontrol-*.apk
# Chinese UI needs the translation package as well
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

Before compiling it runs syntax checks (`node --check`, `sh -n`). They take
seconds and catch a broken view or init script, rather than letting it surface
minutes later inside the SDK.

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

## License

GNU General Public License v3.0 (GPL-3.0-only) - see [LICENSE](LICENSE).
