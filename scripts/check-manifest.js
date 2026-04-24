#!/usr/bin/env node

const assert = require('assert');
const manifest = require('../package.json');

const viewTitle = manifest.contributes.menus['view/title'];
assert(
  !viewTitle.some(item => item.command === 'tmuxManager.createSession'),
  'New Session must not be a top-level title button; it belongs on connection context menus'
);

const context = manifest.contributes.menus['view/item/context'];
const connectionNewSessionItems = context.filter(
  item => item.command === 'tmuxManager.createSession' && /localConnection|sshConnection/.test(item.when || '')
);
assert.strictEqual(
  connectionNewSessionItems.length,
  2,
  'New Session must appear on both local and SSH connection context menus'
);

assert(
  !manifest.contributes.commands.some(command => command.command === 'tmuxManager.openTerminal'),
  'Open Terminal command should not be contributed'
);
assert(
  !(manifest.contributes.menus.commandPalette || []).some(item => item.command === 'tmuxManager.openTerminal'),
  'Open Terminal command should not be contributed to the command palette'
);

const addConnection = manifest.contributes.commands.find(command => command.command === 'tmuxManager.addConnection');
assert(addConnection, 'Add SSH Connection command must exist');
assert.notStrictEqual(addConnection.icon, '$(add)', 'Add SSH Connection should use a more specific icon than $(add)');
assert.strictEqual(addConnection.icon, '$(remote)', 'Add SSH Connection should use the remote icon');

const toggleMouseMode = context.find(item => item.command === 'tmuxManager.toggleMouseMode');
assert(toggleMouseMode, 'Toggle Mouse Mode context menu item must exist');
assert.strictEqual(
  toggleMouseMode.group,
  '1_actions@2',
  'Toggle Mouse Mode should appear after New Session on connection context menus'
);

console.log('Manifest menu checks passed.');
