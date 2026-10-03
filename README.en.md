# luci-app-ledcontrol

[简体中文](README.md) | **English**

A small LuCI application for OpenWrt / ImmortalWrt that switches **all** system
LEDs on or off with a single toggle, and keeps that choice across reboots.

* LuCI 2 (client side JavaScript) - no legacy Lua CBI views.
* English and Simplified Chinese (`zh_Hans`) built in - **no** separate
  `luci-i18n-*` package to install.
* Supports both package formats: `.ipk` (opkg, OpenWrt 24.10) and `.apk`
  (apk-openssl, OpenWrt 25.12+).

## How it works

The package consists of three cooperating pieces:

| Component | Path | Purpose |
| --- | --- | --- |
| UCI config | `/etc/config/ledcontrol` | Stores `ledcontrol.global.enable` (`1` = on, `0` = off). |
| init script | `/etc/init.d/ledcontrol` | `START=99`, applies the stored state at the very end of boot. |
| LuCI view | `view/ledcontrol.js` | Renders the toggle and applies changes immediately. |

When you press **Save & Apply**, the browser commits the UCI change and then
calls `ubus call rc init {"name":"ledcontrol","action":"restart"}`, so the LEDs
change state right away - no reboot needed. Because the init script runs again
on every boot at `START=99` (after the kernel LED triggers and the board
default LED configuration have been set up), the chosen state survives a
reboot.

The LED loop is exactly the one from the specification:

```sh
for i in /sys/class/leds/*; do [ -e "$i/brightness" ] && echo 0 > "$i/brightness"; done
```

with `1` written instead of `0` when LEDs are enabled.

## Installation

Download the matching package from the [Releases](../../releases) page, copy it
to the router and install it.

Packages are built for OpenWrt 24.10 (`.ipk`) and 25.12+ (`.apk`). The release
tag and name are read straight from `PKG_VERSION`/`PKG_RELEASE` in the Makefile
(`1.0.2-r1`, say), so the version you download always matches the tag.

**Simplified Chinese and English are both inside this one package** - there is
no language package to install.

OpenWrt 24.10 and older (opkg):

```sh
opkg install luci-app-ledcontrol_*.ipk
```

OpenWrt 25.12 and newer (apk):

```sh
apk add --allow-untrusted luci-app-ledcontrol-*.apk
```

Then open **System → LED Control** in LuCI.

## Command line

```sh
uci set ledcontrol.global.enable='0'
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
make defconfig
make package/luci-app-ledcontrol/compile V=s
```

The resulting packages appear below `bin/packages/<arch>/luci/`.

### With GitHub Actions

`.github/workflows/build.yml` builds the package against the official SDKs of
OpenWrt **24.10.8** (`.ipk`) and **25.12.5** (`.apk`) in a matrix and uploads
the built packages as artifacts. It runs on every push, pull request and manual
dispatch.

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
│   └── zh-cn/ledcontrol.po
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

The `zh-cn` directory name under `po/` is deliberate. luci.mk generates a
`luci-i18n-*` package per directory below `po/`, but only for names that appear
in its built-in language table. `zh_Hans` is in that table, so a `po/zh_Hans`
directory would add a `luci-i18n-ledcontrol-zh-cn` package; `zh-cn` - the name LuCI
itself uses for the compiled `.lmo` - is not, so no language package is
generated and the translation is compiled into the main package instead.

The `menu.d` and `acl.d` files are what actually make the page reachable: the
first registers the *System → LED Control* entry, the second grants the view
read/write access to the `ledcontrol` UCI config and permission to call
`rc init`.

## License

GNU General Public License v3.0 (GPL-3.0-only) - see [LICENSE](LICENSE).
