#
# Copyright (C) 2026 Arthur97172 <arthur97172@outlook.com>
#
# This is free software, licensed under the GNU General Public License v3.0
# (SPDX: GPL-3.0-only).
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ledcontrol
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0-only
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Arthur97172 <Arthur97172@users.noreply.github.com>

LUCI_TITLE:=LuCI app to switch the status LEDs and the network port LEDs on or off
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all
LUCI_URL:=https://github.com/Arthur97172/luci-app-ledcontrol
LUCI_MAINTAINER:=Arthur97172 <Arthur97172@users.noreply.github.com>

# ---------------------------------------------------------------------------
# Simplified Chinese ships inside the main package, not as a separate
# luci-i18n-ledcontrol-zh-cn package, so one install gives both languages.
#
# luci.mk derives its translation packages from the directory names below ./po
# (luci.mk:10) and only defines one for a language that also appears in its
# built-in LUCI_LANG.* table (luci.mk:354). "zh_Hans" is in that table, so a
# po/zh_Hans directory would make luci.mk emit luci-i18n-ledcontrol-zh-cn. The
# directory is therefore named "zh-cn" - the tag LuCI itself uses for the
# compiled catalog, see LUCI_LC_ALIAS.zh_Hans=zh-cn - which leaves
# LUCI_LANGUAGES non-empty but unmatched, so no translation package is defined.
#
# English needs no file at all: LuCI's _() returns the msgid unchanged when no
# translation matches, so the English strings in ledcontrol.js are their own
# translation.
#
# Compiling the catalog into $(PKG_BUILD_DIR)/root/ is what gets it into the
# package: luci.mk's generated Package/$(PKG_NAME)/install copies
# $(PKG_BUILD_DIR)/root/* into the package verbatim (luci.mk:221-224), so the
# .lmo is picked up along with everything else under root/.
#
# This block has to sit *before* the include, and has to say `override`. luci.mk
# unconditionally replaces Build/Compile with an empty one for packages without
# a src/Makefile (luci.mk:196-199), and it calls BuildPackage itself at its own
# line 355. BuildPackage expands Build/Compile while it runs
# (include/package.mk:296 -> 245), so the recipe is fixed at that moment: a
# definition written after the include is never looked at, and a plain one
# written before it gets overwritten. `override` is the only spelling that both
# precedes the include and survives it. Re-calling BuildPackage afterwards does
# not help either, because Build/DefaultTargets clears itself after its first
# use (package.mk:298).
# ---------------------------------------------------------------------------
override define Build/Compile
	$(INSTALL_DIR) $(PKG_BUILD_DIR)/root/usr/lib/lua/luci/i18n
	po2lmo ${CURDIR}/po/zh-cn/ledcontrol.po \
		$(PKG_BUILD_DIR)/root/usr/lib/lua/luci/i18n/ledcontrol.zh-cn.lmo
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
#
# The line above is load bearing and must not be removed: OpenWrt's package
# scanner (include/scan.mk) discovers package directories by grepping their
# Makefile for the literal text "call BuildPackage". Without it the package is
# silently skipped and "make package/luci-app-ledcontrol/compile" fails with
# "No rule to make target".
#
# Note that the macro itself is *not* invoked here: luci.mk already calls
# BuildPackage for every entry in LUCI_BUILD_PACKAGES, which for this package
# is just $(PKG_NAME) - see the note above on why no luci-i18n-* package is
# generated. The literal text above exists purely so that include/scan.mk can
# find the package directory.
