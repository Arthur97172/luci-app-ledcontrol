#!/usr/bin/env node
/*
 * i18n 回归测试：把「view 里的文案」和「po 里的译文」对成一条可执行的断言。
 *
 * 为什么需要它：_() 的查表是「精确匹配 + trim」，任何一处 msgid 对不上都会静默
 * 退回英文（不报错、不警告）。页面上少一行中文，构建日志里不会有任何痕迹，只有
 * 用户会看到。本文件把这条链路变成 CI 能拦住的东西。
 *
 * 三件必须守住的事：
 *   1. po/ 下的语言目录名决定 luci.mk 生成哪个语言包（luci.mk:10 收集目录名，
 *      luci.mk:354 对命中 LUCI_LANG.* 的名字调 LuciTranslation）。改成不认识的
 *      名字，语言包就悄悄消失了 —— 所以这里把目录名钉死。
 *   2. po2lmo 的 extract_string 只反转义 \" 和 \\，不处理 \n。所以 msgid 必须是
 *      单行纯文本；po 的解析必须照此实现，不能用 JSON.parse（那会反转义 \n，
 *      恰好掩盖这类失效）。
 *   3. msgid 不得有首尾空白 —— _() 查表前会 trim。
 *
 * 注意：扫描 JS 源码用的正则也会命中注释里的 _('...') 示例，所以不要在 view 的
 * 注释里写这种例子。
 *
 * 运行：node tests/i18n.test.js
 */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var PO_ROOT = path.join(ROOT, 'po');
var JS_PATH = path.join(ROOT, 'htdocs/luci-static/resources/view/ledcontrol.js');
var MENU_PATH = path.join(ROOT, 'root/usr/share/luci/menu.d/luci-app-ledcontrol.json');

// luci.mk 的 LUCI_LANG 表里叫 zh_Hans，LUCI_LC_ALIAS 把它映射成产物用的 zh-cn，
// 于是语言包名为 luci-i18n-ledcontrol-zh-cn（luci.mk:75/325）。
var LANG_DIR = 'zh_Hans';
var LANG_TAG = 'zh-cn';
var PKG_BASENAME = 'ledcontrol';
var I18N_PACKAGE = 'luci-i18n-' + PKG_BASENAME + '-' + LANG_TAG;

var fails = 0, checks = 0;
function ok(cond, label, extra) {
	checks++;
	if (!cond) { fails++; console.log('FAIL  ' + label + (extra ? '\n      ' + extra : '')); }
}
function eq(got, want, label) {
	ok(got === want, label, 'got:  ' + JSON.stringify(got) + '\n      want: ' + JSON.stringify(want));
}

// ---------- A. 守卫：po/ 的语言目录名 ----------
//
// 目录名是整条打包链路唯一的开关：叫 zh_Hans 才会生成 luci-i18n-ledcontrol-zh-cn；
// 叫别的（例如早期的 zh-cn）luci.mk 就不生成语言包，译文只能靠主包手工内联。

console.log('--- A. 守卫：po/ 语言目录名 ---');
var langDirs = fs.readdirSync(PO_ROOT).filter(function(d) {
	return d !== 'templates' && fs.statSync(path.join(PO_ROOT, d)).isDirectory();
});
eq(langDirs.length, 1, 'po/ 下应恰好有一个语言目录');
eq(langDirs[0], LANG_DIR, '语言目录名必须是 ' + LANG_DIR + '（否则 luci.mk 不生成 ' + I18N_PACKAGE + '）');
ok(fs.existsSync(path.join(PO_ROOT, 'templates', PKG_BASENAME + '.pot')),
	'缺少 po/templates/' + PKG_BASENAME + '.pot');

var PO_PATH = path.join(PO_ROOT, LANG_DIR, PKG_BASENAME + '.po');
ok(fs.existsSync(PO_PATH), '缺少 ' + path.relative(ROOT, PO_PATH));

// ---------- B. 载入 po，建立与 cbi.js 一致的 _() ----------

// 复刻 po2lmo 的 extract_string：只反转义 \" 和 \\，其余原样保留。
function poUnescape(s) {
	var out = '', i = 0;
	while (i < s.length) {
		if (s[i] === '\\' && i + 1 < s.length && (s[i + 1] === '"' || s[i + 1] === '\\')) {
			out += s[i + 1];
			i += 2;
		} else {
			out += s[i];
			i++;
		}
	}
	return out;
}

var TR = {};
(function parsePo() {
	if (!fs.existsSync(PO_PATH)) return;
	var lines = fs.readFileSync(PO_PATH, 'utf8').split('\n');
	for (var i = 0; i < lines.length; i++) {
		var mid = lines[i].match(/^msgid "(.*)"$/);
		if (!mid) continue;
		var mstr = (lines[i + 1] || '').match(/^msgstr "(.*)"$/);
		if (!mstr) continue;
		var key = poUnescape(mid[1]);
		if (key) TR[key] = poUnescape(mstr[1]);
	}
})();

// 复刻 luci-base 的 _()：查表键会 trim，查不到就原样返回。
function _(s) {
	var k = String(s).trim();
	return TR[k] || s;
}

// ---------- C. 从 view 里收集 _() 字面量 ----------

var jsSrc = fs.readFileSync(JS_PATH, 'utf8');
var jsLits = {};
(function collectLits() {
	var re = /_\(\s*(['"])((?:[^\\]|\\.)*?)\1\s*\)/g, m;
	while ((m = re.exec(jsSrc))) {
		try { jsLits[(0, eval)(m[1] + m[2] + m[1])] = 1; } catch (e) { /* 跨行拼接等，跳过 */ }
	}
})();

console.log('--- C. view 的 _() 字面量 ---');
ok(Object.keys(jsLits).length > 0, 'view 里没有扫描到任何 _() 字面量（正则或路径失效？）');
console.log('      (' + Object.keys(jsLits).length + ' 条字面量)');

// ---------- D. 守卫：每个 _() 字面量都必须能命中 po ----------

console.log('--- D. 守卫：_() 字面量 vs po ---');
var orphans = Object.keys(jsLits).filter(function(k) { return !TR[k.trim()]; });
ok(orphans.length === 0, '存在查表必然落空的 _() 字面量（会静默显示英文）',
	orphans.map(function(k) {
		var why = '';
		if (k !== k.trim()) why = '  ← 首尾有空白，_() 查表前会 trim';
		else if (/\n/.test(k)) why = '  ← 含真实换行：po2lmo 不反转义 \\n，键必然对不上';
		return JSON.stringify(k) + why;
	}).join('\n      '));

// ---------- E. 守卫：msgid 不得含 po2lmo 不处理的转义 ----------
//
// po2lmo 的 extract_string 只反转义 \" 和 \\。JS 源码里任何其他转义（\n \t \u …）
// 都会被 JS 解析器先变成真实字符，而 po 里存的是字面反斜杠序列 —— 两边哈希不同，
// 译文永远查不到。

var BAD_ESC = /\\(?![\\"])/;
var escLit = Object.keys(jsLits).filter(function(k) { return BAD_ESC.test(k); });
ok(escLit.length === 0, '_() 字面量含 po2lmo 不处理的转义（\\n 等），译文必然失效',
	escLit.map(function(k) { return JSON.stringify(k).slice(0, 80); }).join('\n      '));

// ---------- F. 守卫：msgid 不允许首尾带空白 ----------

console.log('--- F. 守卫：msgid 首尾空白 ---');
var padded = Object.keys(TR).filter(function(k) { return k !== k.trim(); });
ok(padded.length === 0, 'msgid 带首尾空格，_() 永远查不到',
	padded.map(function(k) { return JSON.stringify(k); }).join('\n      '));
console.log('      (' + Object.keys(TR).length + ' 条 msgid，无首尾空格)');

// ---------- G. 守卫：msgstr 不得为空 ----------

console.log('--- G. 守卫：msgstr 非空 ---');
var empty = Object.keys(TR).filter(function(k) { return !TR[k]; });
ok(empty.length === 0, '存在空 msgstr（该条会退回英文）',
	empty.map(function(k) { return JSON.stringify(k); }).join('\n      '));

// ---------- H. 守卫：menu.d 的标题被覆盖 ----------
//
// 菜单标题由服务端用同一个 catalog 翻译（dispatcher 的 menu_json），所以它必须在
// po 里，否则侧边栏永远是英文。

console.log('--- H. 守卫：menu.d 标题 ---');
var menu = JSON.parse(fs.readFileSync(MENU_PATH, 'utf8'));
Object.keys(menu).forEach(function(key) {
	var title = menu[key].title;
	if (!title) return;
	ok(!!TR[title.trim()], 'menu.d 标题 "' + title + '" 没有译文',
		'在 po 里补一条 msgid "' + title + '"');
});

// ---------- I. 反向：po 里不应有孤儿 msgid ----------

console.log('--- I. 守卫：po 孤儿条目 ---');
var orphanMsgs = Object.keys(TR).filter(function(k) { return !jsLits[k]; });
ok(orphanMsgs.length === 0, 'po 里有 view 用不到的 msgid（多半是文案改过、po 没跟着改）',
	orphanMsgs.map(function(k) { return JSON.stringify(k); }).join('\n      '));

// ---------- 汇总 ----------

console.log('\n' + (fails === 0 ? '✅ 全部通过' : '❌ 有失败') + '：' + (checks - fails) + '/' + checks);
process.exit(fails ? 1 : 0);
