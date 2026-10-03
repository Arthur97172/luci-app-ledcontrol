'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';

/*
 * Restart the ledcontrol init script through ubus so that the LED state changes
 * immediately, without the user having to reboot the device.
 *
 * The matching ACL grant is  write > ubus > rc > [ "init" ]  and lives in
 * root/usr/share/rpcd/acl.d/luci-app-ledcontrol.json.
 */
var callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ]
});

return view.extend({
	load: function() {
		return uci.load('ledcontrol');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('ledcontrol', _('LED Control'),
			_('Turn all system LEDs on or off with a single switch.'));

		s = m.section(form.NamedSection, 'global', 'ledcontrol', _('Global Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enable', _('Enable LEDs'),
			_('Controls the status of LEDs. Settings take effect immediately and will persist after a reboot (ON or OFF).'));
		o.default = '1';
		o.rmempty = false;

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {
			/*
			 * Commit the staged UCI change first, so that the init script
			 * restarted below already reads the new "enable" value.
			 *
			 * uci.apply() is the raw ubus RPC rather than the HTTP endpoint
			 * the stock footer posts to, and it answers UBUS_STATUS_NO_DATA
			 * when there is nothing staged to commit - which is exactly the
			 * case when Save & Apply is pressed without touching the switch.
			 * The call is declared reject: true, so that status arrives as a
			 * rejected promise and would be reported below as a bogus failure
			 * of an operation that was really a no-op. Ask uci.changes() for
			 * the staged changeset and commit only when it is non-empty.
			 */
			return uci.changes();
		}).then(function(changes) {
			var pending = 0;

			for (var config in changes)
				pending += changes[config].length;

			return pending ? uci.apply() : null;
		}).then(function() {
			return callRcInit('ledcontrol', 'restart');
		}).then(function() {
			/*
			 * Reload so the form shows the committed state. Deliberately no
			 * success notification: the reload replaces the page a moment
			 * later, so a toast would only flash past. The error branch below
			 * keeps its notification, because on failure nothing reloads and
			 * the user would otherwise see no sign that anything went wrong.
			 */
			window.location.reload();
		}).catch(function(err) {
			ui.addNotification(null, E('p', _('Failed to apply the LED settings: %s').format(err)), 'error');
		});
	}
});
