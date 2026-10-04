# luci-app-ledcontrol

**简体中文** | [English](README.en.md)

一个用于 OpenWrt / ImmortalWrt 的小型 LuCI 应用，通过两个独立开关分别控制
**设备指示灯**与**网口指示灯**，并且所选的组合会在重启后自动恢复。

* 基于 LuCI 2（客户端 JavaScript），不含传统的 Lua CBI 视图。
* 内置英文与简体中文（`zh_Hans`）界面，**无需**再单独安装 `luci-i18n-*`
  语言包。
* 同时支持两种软件包格式：`.ipk`（opkg，OpenWrt 24.10）与 `.apk`
  （apk-openssl，OpenWrt 25.12+）。

## 工作原理

本软件包由三个相互配合的部分组成：

| 组件 | 路径 | 作用 |
| --- | --- | --- |
| UCI 配置 | `/etc/config/ledcontrol` | 保存 `ledcontrol.global.status_leds` 与 `ledcontrol.global.net_leds`（`1` = 开启，`0` = 关闭）。 |
| init 脚本 | `/etc/init.d/ledcontrol` | `START=99`，在启动过程的最后阶段应用已保存的状态。 |
| LuCI 视图 | `view/ledcontrol.js` | 渲染两个开关，并让改动立即生效。 |

当您点击 **保存并应用** 时，浏览器会先提交 UCI 改动，然后调用
`ubus call rc init {"name":"ledcontrol","action":"restart"}`，因此 LED 会立刻改变
状态，无需重启。由于 init 脚本在每次启动时都会于 `START=99` 阶段再次运行
（此时内核 LED 触发器与主板默认 LED 配置均已初始化完毕），所以所选的设置能够
在重启后保持。

两个开关的组合效果：

| 设备指示灯 | 网口指示灯 | 结果 |
| --- | --- | --- |
| 开 | 开 | 全部点亮 |
| 开 | 关 | 仅设备指示灯亮，网口灯熄灭 |
| 关 | 开 | 仅网口灯亮，设备指示灯熄灭 |
| 关 | 关 | 全部熄灭 |

判定规则：`/sys/class/leds/` 下的目录名（即 LED 名字）中包含 `wan`、`lan`、
`port`、`eth`、`sw` 或 `gphy` 关键字的，属于**网口指示灯**，由「启用网口指示灯」
控制；其余（电源、Wi-Fi、USB 等）由「启用设备指示灯」控制。

Wi-Fi 指示灯是唯一需要特别处理的一类：它们的名字通常是 `wlan`、`wlan0`、
`wlan2g`，而 `wlan` 里含有 `lan`，单纯的子串匹配会把它们卷进网口组。它们属于
**设备指示灯**，所以 Wi-Fi 的判定写在最前面并且优先命中。`ath9k-phy0` 这类由
mac80211 注册的 Wi-Fi PHY 灯同样是设备指示灯 —— 这也是网口关键字用 `gphy`
而不是单独的 `phy` 的原因。

init 脚本对每个 LED 写入它所属开关的值，四种组合由此自然覆盖：

```sh
for led in /sys/class/leds/*; do
	[ -e "$led/brightness" ] || continue
	if is_net_led "${led##*/}"; then value="$net_value"; else value="$status_value"; fi
	if [ "$value" = "0" ]; then
		echo 0 > "$led/brightness"
	else
		echo "$(cat "$led/max_brightness")" > "$led/brightness"
	fi
done
```

**「开启」写入的是该灯自己的 `max_brightness`，而不是固定的 `1`。** `brightness`
不是布尔值，而是 `0 … max_brightness` 的区间：普通 GPIO 灯 `max_brightness` 为
`1`（与写 `1` 完全等价），而 PWM 灯与 RGB 多色灯通常为 `255` —— 对它写 `1` 只有
1/255 的亮度，肉眼等同熄灭。`max_brightness` 由 LED class 为每个灯注册，内核还会
在驱动没有设置时强制其为 `LED_FULL`，所以读取它总是安全的。

**「关闭」固定写 `0`。** 内核在写入 0 时会顺带摘除该灯的触发器
（`led_trigger_remove`），所以被关掉的灯不会被 `timer`、`heartbeat` 之类的触发器
重新点亮。反过来，写非 0 值不会动触发器，因此「开启」的含义是**让灯恢复它本来的
行为**，而不是强制常亮 —— 挂着 `netdev` 触发器的网口灯仍会随流量闪烁。也正因为
关灯会摘掉触发器，关一次再开不会自动恢复它，**重启一次**即可（开机时板级 LED
配置会重新挂上触发器，之后 `START=99` 再应用您选择的状态）。

关键字匹配用 POSIX 的 `case` 通配符实现，而不是 bash 的 `[[ "$i" =~ "wan" ]]`：
OpenWrt / ImmortalWrt 的 `/bin/sh` 是 busybox ash，**既不支持 `[[ ]]` 也不支持
`=~`**，写成 bash 语法会让 init 脚本每次启动都报语法错误、状态完全无法应用。

### 从 1.0.x 升级

1.0.x 只有一个 `ledcontrol.global.enable` 开关。升级时
`/etc/uci-defaults/luci-app-ledcontrol` 会把它的值同时写入两个新开关并删除旧
选项，因此升级后仍然是您上次选择的状态；init 脚本也会在旧选项仍然存在时把
它当作两个新开关的回退值（例如从 1.0.x 备份恢复配置之后）。

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
