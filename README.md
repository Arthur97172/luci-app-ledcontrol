# luci-app-ledcontrol

**简体中文** | [English](README.en.md)

一个用于 OpenWrt / ImmortalWrt 的小型 LuCI 应用，通过一个开关即可打开或关闭
**所有**系统 LED 指示灯，并且该设置会在重启后自动恢复。

* 基于 LuCI 2（客户端 JavaScript），不含传统的 Lua CBI 视图。
* 内置英文与简体中文（`zh_Hans`）界面，**无需**再单独安装 `luci-i18n-*`
  语言包。
* 同时支持两种软件包格式：`.ipk`（opkg，OpenWrt 24.10）与 `.apk`
  （apk-openssl，OpenWrt 25.12+）。

## 工作原理

本软件包由三个相互配合的部分组成：

| 组件 | 路径 | 作用 |
| --- | --- | --- |
| UCI 配置 | `/etc/config/ledcontrol` | 保存 `ledcontrol.global.enable`（`1` = 开启，`0` = 关闭）。 |
| init 脚本 | `/etc/init.d/ledcontrol` | `START=99`，在启动过程的最后阶段应用已保存的状态。 |
| LuCI 视图 | `view/ledcontrol.js` | 渲染开关，并让改动立即生效。 |

当您点击 **保存并应用** 时，浏览器会先提交 UCI 改动，然后调用
`ubus call rc init {"name":"ledcontrol","action":"restart"}`，因此 LED 会立刻改变
状态，无需重启。由于 init 脚本在每次启动时都会于 `START=99` 阶段再次运行
（此时内核 LED 触发器与主板默认 LED 配置均已初始化完毕），所以所选的设置能够
在重启后保持。

LED 循环与规格说明中完全一致：

```sh
for i in /sys/class/leds/*; do [ -e "$i/brightness" ] && echo 0 > "$i/brightness"; done
```

当 LED 处于启用状态时，写入的值为 `1` 而不是 `0`。

## 安装

从 [Releases](../../releases) 页面下载对应的软件包，复制到路由器上并安装。

软件包针对 OpenWrt 24.10（`.ipk`）与 25.12+（`.apk`）构建。Release 的 tag 与
名称直接取自 Makefile 中的 `PKG_VERSION`/`PKG_RELEASE`（例如 `1.0.2-r1`），
所以下载到的版本号一定与 tag 一致。

**简体中文与英文界面都已包含在这一个包里**，不需要再安装任何语言包。

OpenWrt 24.10 及更早版本（opkg）：

```sh
opkg install luci-app-ledcontrol_*.ipk
```

OpenWrt 25.12 及更新版本（apk）：

```sh
apk add --allow-untrusted luci-app-ledcontrol-*.apk
```

然后打开 LuCI 中的 **系统 → LED 指示灯控制**。

## 命令行

```sh
uci set ledcontrol.global.enable='0'
uci commit ledcontrol
/etc/init.d/ledcontrol restart
```

## 构建

### 使用 OpenWrt SDK

```sh
# 在已解压的 SDK 目录中执行
mkdir -p package/luci-app-ledcontrol
rsync -a --exclude .git ./ package/luci-app-ledcontrol/
./scripts/feeds update -a
./scripts/feeds install -a
make defconfig
make package/luci-app-ledcontrol/compile V=s
```

生成的软件包会出现在 `bin/packages/<arch>/luci/` 下。

### 使用 GitHub Actions

`.github/workflows/build.yml` 会以矩阵方式，针对 OpenWrt **24.10.8**
（`.ipk`）与 **25.12.5**（`.apk`）的官方 SDK 构建本软件包，并把编译出的安装包
作为构建产物上传。每次 push、pull request 以及手动触发时都会运行。

推送时还会把软件包发布到 Releases 页面，tag 与名称都直接读取 Makefile 里的
`PKG_VERSION`/`PKG_RELEASE`，因此版本号只有一个来源，软件包与 tag 不会出现
不一致。pull request 只构建，不会发布。

## 仓库结构

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

真正让页面可以被访问到的是 `menu.d` 与 `acl.d` 这两个文件：前者注册了
*系统 → LED 指示灯控制* 菜单项，后者授予该视图读写 `ledcontrol` UCI 配置以及调用
`rc init` 的权限。

`po/` 下的目录名 `zh-cn` 是刻意取的。luci.mk 会按照 `po/` 下的目录名自动生成
`luci-i18n-*` 语言包，但只对出现在它内置语言表里的名字生效：`zh_Hans` 在表里，
所以目录若叫 `po/zh_Hans` 就会多出一个 `luci-i18n-ledcontrol-zh-cn` 包；改叫
`zh-cn`（LuCI 自己给编译产物 `.lmo` 用的名字）就不在表里，于是不会生成语言包，
翻译得以直接编译进主包。

## 许可证

GNU General Public License v3.0（GPL-3.0-only）- 详见 [LICENSE](LICENSE)。
