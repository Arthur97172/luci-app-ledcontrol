# luci-app-ledcontrol

**简体中文** | [English](README.en.md)

一个用于 OpenWrt / ImmortalWrt 的小型 LuCI 应用，通过两个独立开关分别控制
**设备指示灯**与**网口指示灯**，并且所选的组合会在重启后自动恢复。

* 基于 LuCI 2（客户端 JavaScript），不含传统的 Lua CBI 视图。
* 界面为英文；简体中文由单独的 `luci-i18n-ledcontrol-zh-cn` 语言包提供，
  与主程序包在同一个 Release 里发布。
* 同时支持两种软件包格式：`.ipk`（opkg，OpenWrt 24.10）与 `.apk`
  （apk-openssl，OpenWrt 25.12+）。

## 工作原理

本软件包由三个部分组成：

| 组件 | 路径 | 作用 |
| --- | --- | --- |
| UCI 配置 | `/etc/config/ledcontrol` | 保存两个开关的状态（`1` = 开，`0` = 关）。 |
| init 脚本 | `/etc/init.d/ledcontrol` | 开机时（`START=99`）把保存的状态写入各个 LED。 |
| LuCI 视图 | `view/ledcontrol.js` | 提供两个开关，改动立即生效。 |

点击 **保存并应用** 后，浏览器先提交 UCI 改动，再重启 init 脚本，因此 LED 立刻
改变状态、无需重启；init 脚本每次开机都会再执行一遍，所以设置在重启后依然保持。

两个开关的组合效果：

| 设备指示灯 | 网口指示灯 | 结果 |
| --- | --- | --- |
| 开 | 开 | 全部点亮 |
| 开 | 关 | 仅设备指示灯亮 |
| 关 | 开 | 仅网口灯亮 |
| 关 | 关 | 全部熄灭 |

**判定规则**：LED 名字（`/sys/class/leds/` 下的目录名）中包含 `wan`、`lan`、
`port`、`eth`、`sw` 或 `gphy` 的属于**网口指示灯**；其余（电源、Wi-Fi、USB 等）
属于**设备指示灯**。Wi-Fi 灯（名字含 `wlan`）算设备指示灯。

## 安装

从 [Releases](../../releases) 页面下载对应的软件包，复制到路由器上并安装。

软件包针对 OpenWrt 24.10（`.ipk`）与 25.12+（`.apk`）构建。Release 的 tag 与
名称直接取自 Makefile 中的 `PKG_VERSION`/`PKG_RELEASE`（例如 `1.0.2-r1`），
所以下载到的版本号一定与 tag 一致。

主程序包只带英文界面。需要简体中文时，从同一个 Release 里再装语言包：

OpenWrt 24.10 及更早版本（opkg）：

```sh
opkg install luci-app-ledcontrol_*.ipk
# 中文界面需额外安装翻译包
opkg install luci-i18n-ledcontrol-zh-cn_*.ipk
```

OpenWrt 25.12 及更新版本（apk）：

```sh
apk add --allow-untrusted luci-app-ledcontrol-*.apk
# 中文界面需额外安装翻译包
apk add --allow-untrusted luci-i18n-ledcontrol-zh-cn-*.apk
```

装好后，LuCI 的 **系统 → 语言和界面** 里会出现「简体中文」；语言设置保持默认的
`auto` 时，浏览器语言为中文会自动选中它。

然后打开 LuCI 中的 **系统 → LED 指示灯控制**。

## 命令行

```sh
# 关闭设备指示灯，保留网口灯
uci set ledcontrol.global.status_leds='0'
uci set ledcontrol.global.net_leds='1'
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
# 显式选中简体中文。语言包的 DEFAULT 是 LUCI_LANG_zh_Hans||(ALL&&m)，
# 而 SDK 默认不设 CONFIG_ALL，不写这一行就编译不出语言包。
echo "CONFIG_LUCI_LANG_zh_Hans=y" >> .config
make defconfig
make package/luci-app-ledcontrol/compile V=s
```

生成的软件包会出现在 `bin/packages/<arch>/base/` 下，共两个：
`luci-app-ledcontrol_*.ipk` 与 `luci-i18n-ledcontrol-zh-cn_*.ipk`（`.apk` 同理）。

### 使用 GitHub Actions

`.github/workflows/build.yml` 会以矩阵方式，针对 OpenWrt **24.10.8**
（`.ipk`）与 **25.12.5**（`.apk`）的官方 SDK 构建本软件包，并把编译出的安装包
作为构建产物上传。每次 push、pull request 以及手动触发时都会运行。

编译前先跑一个 `test` job：`node tests/i18n.test.js` 加语法检查（`node --check`、
`sh -n`）。它只有几秒钟，但能拦住「文案改了、po 没跟着改」这类只会让界面静默
退回英文的问题。`build` 依赖它，测试不过就不编译。

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

## 许可证

GNU General Public License v3.0（GPL-3.0-only）- 详见 [LICENSE](LICENSE)。
