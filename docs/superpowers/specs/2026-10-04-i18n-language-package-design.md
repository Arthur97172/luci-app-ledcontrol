# 简体中文改为独立语言包

日期：2026-10-04
状态：已批准，待实现

## 目标

让 `luci-app-ledcontrol` 像 `luci-app-online-upgrade` 一样，把简体中文编译成**独立的
`luci-i18n-ledcontrol-zh-cn` 包**，而不是编译进主包。

## 背景：现状与机制

### 现状

主包把简体中文塞进自己体内：

- `po/` 目录刻意命名为 `zh-cn`（而非 `zh_Hans`），使 luci.mk 不生成语言包；
- Makefile 用 `override define Build/Compile` 手工调 `po2lmo`，把 `.lmo` 写进
  `$(PKG_BUILD_DIR)/root/`，靠 luci.mk 的 `root/` 拷贝规则带进主包；
- 主包的 `uci-defaults` 自己写 `luci.languages.zh_cn`。

### luci.mk 机制（逐行审计，非推测）

| 环节 | 依据 | 结论 |
| --- | --- | --- |
| 语言包怎么生成 | `luci.mk:10` 从 `po/*` 目录名收集 `LUCI_LANGUAGES`；`luci.mk:354` 对命中 `LUCI_LANG.*` 的名字调 `LuciTranslation` | `zh_Hans` 在 `luci.mk:59` 的表里，`po/zh_Hans` 会生成 `luci-i18n-ledcontrol-zh-cn` |
| 产物文件名 | `luci.mk:75` `LUCI_LC_ALIAS.zh_Hans=zh-cn`；`luci.mk:347` 输出 `<basename>.<1>.lmo` | 仍叫 `ledcontrol.zh-cn.lmo`，与现在同名 |
| 语言包内容 | `luci.mk:340-348` | `.lmo` + 自带 `uci-defaults`（写 `luci.languages.zh_cn`） |
| 语言包版本 | `luci.mk:118` `PKG_PO_VERSION?=$(call findrev)` | 无 `.git` 时退化为 `po/` 文件时间戳，如 `0.261004.44260` |
| 客户端取词 | `luci-base/ucode/controller/admin/index.uc:124` 输出 `window.TR`；`lmo.c:237` 按 `*.zh-cn.lmo` 通配加载 | 文件名不变即无需改 JS |
| 语言下拉框 | `dispatcher.uc:92` 查 `luci.languages.zh_cn` | 由语言包自己的 uci-defaults 注册 |
| 包目录发现 | `scan.mk:72,77` `GREP_STRING=(Build/DefaultTargets\|BuildPackage\|KernelPackage)` | 末尾 `call BuildPackage` 字面量必须保留 |

### 实测结论（24.10 SDK 实编）

`po/zh-cn` → `po/zh_Hans` 并删除 `override Build/Compile` 后：

- 产出 `luci-app-ledcontrol_1.1.2-r1_all.ipk`（不含 `.lmo`）；
- 产出 `luci-i18n-ledcontrol-zh-cn_1.1.2-r1_all.ipk`（含 `ledcontrol.zh-cn.lmo` 与
  `etc/uci-defaults/luci-i18n-ledcontrol-zh-cn`）；
- 加 `PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)` 后，语言包版本由
  `0.261004.44260` 变为 `1.1.2-r1`。

## 行为变化

**只装主包时界面为纯英文**；中文需另装 `luci-i18n-ledcontrol-zh-cn`。这是"独立语言包"
的定义，也是 LuCI 官方惯例（如 `luci-i18n-base-zh-cn`）。

## 改动清单

1. **`po/zh-cn/` → `po/zh_Hans/`** — 重命名目录，触发 luci.mk 生成语言包。
2. **`Makefile`**
   - 删除 `override define Build/Compile` 及其 40 行注释；
   - 新增 `PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)`（须在 `include luci.mk` 之前，
     luci.mk 用 `?=` 故会被尊重）；
   - 改写末尾 `call BuildPackage` 说明（不再说"不生成语言包"）。
3. **`root/etc/uci-defaults/luci-app-ledcontrol`** — 删除 `luci.languages.zh_cn` 段。
4. **`.github/workflows/build.yml`**
   - 配置阶段加 `CONFIG_LUCI_LANG_zh_Hans=y`。**必须**：25.12 SDK 实测 `CONFIG_ALL`
     未设，而语言包 `DEFAULT:=LUCI_LANG_zh_Hans||(ALL&&m)`，不显式选中就编译不出来；
   - 产物收集放宽到 `luci-*ledcontrol*.$ext`，并加"语言包缺失即失败"的校验；
   - 新增 `test` job（`node tests/i18n.test.js` + `node --check`），build 依赖它；
   - 更新 Release 说明。
5. **`tests/i18n.test.js`（新增）** — 纯 node、零依赖。断言：
   - view 里每个 `_()` 字面量都能在 po 命中（防静默退回英文）；
   - po 里没有孤儿 msgid；
   - msgid 无首尾空白（`_()` 查表前 trim）；
   - msgid 不含 po2lmo 不处理的转义（`\n` `\t` 等，po2lmo 只反转义 `\"` 与 `\\`）；
   - `menu.d` 的标题也被 po 覆盖。
6. **`README.md` / `README.en.md`** — 更新"无需语言包"表述、目录树、安装与构建说明。

## 验证

- 24.10 SDK 实编 → 两个 `.ipk`，逐一检查内容与 control 元数据；
- 25.12 SDK 实编 → 两个 `.apk`；
- `node tests/i18n.test.js` 全绿；
- `node --check` view JS、`sh -n` init 脚本与 uci-defaults；
- 清理临时 SDK 副本。

## 非目标

- 不改动 init 脚本、UCI 配置、ACL、菜单逻辑；
- 不新增简体中文以外的语言；
- 不重构 view JS。
