#
# Copyright (C) 2026 Arthur97172 <arthur97172@outlook.com>
#
# This is free software, licensed under the GNU General Public License v3.0
# (SPDX: GPL-3.0-only).
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ledcontrol
PKG_VERSION:=1.1.2
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
# Simplified Chinese ships as its own luci-i18n-ledcontrol-zh-cn package.
#
# luci.mk builds one translation package per directory under ./po, but only for
# directory names that also appear in its built-in LUCI_LANG.* table: luci.mk:10
# collects the directory names into LUCI_LANGUAGES and luci.mk:354 emits a
# LuciTranslation package for each one it recognises. The directory is therefore
# po/zh_Hans - the spelling in that table - and luci.mk turns it into
# luci-i18n-ledcontrol-zh-cn, whose install rule compiles po/zh_Hans/*.po with
# po2lmo into usr/lib/lua/luci/i18n/ and ships a uci-defaults that registers
# 简体中文 in luci.languages (luci.mk:340-348).
#
# The catalog is named ledcontrol.zh-cn.lmo rather than ledcontrol.zh_Hans.lmo
# because LUCI_LC_ALIAS.zh_Hans=zh-cn (luci.mk:75) supplies the tag LuCI itself
# uses for the compiled catalog. That name is load bearing: the ucode dispatcher
# loads every *.zh-cn.lmo in that directory (lmo.c:237), so it must not change.
#
# English needs no file at all: LuCI's _() returns the msgid unchanged when no
# translation matches, so the English strings in ledcontrol.js are their own
# translation.
# ---------------------------------------------------------------------------

# The translation package would otherwise take its version from luci.mk's
# findrev helper (luci.mk:118), which derives it from the newest commit touching
# po/ - and falls back to plain file mtimes when there is no git history, as in
# a CI checkout, yielding something like "0.261004.44260". Pinning it to the
# release version keeps every package in a release telling the same story.
# luci.mk assigns PKG_PO_VERSION with ?=, so this definition is respected, and
# it also skips findrev during the package scan.
PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
#
# The line above is load bearing and must not be removed: OpenWrt's package
# scanner discovers package directories by grepping their Makefile for the
# literal text "call BuildPackage" - see GREP_STRING in include/scan.mk:72 and
# the find|xargs grep in include/scan.mk:77. Without it the package is silently
# skipped and "make package/luci-app-ledcontrol/compile" fails with "No rule to
# make target".
#
# Note that the macro itself is *not* invoked here: luci.mk already calls
# BuildPackage for every entry in LUCI_BUILD_PACKAGES (luci.mk:355), which for
# this package is luci-app-ledcontrol together with luci-i18n-ledcontrol-zh-cn.
# The literal text above exists purely so that include/scan.mk can find the
# package directory.
