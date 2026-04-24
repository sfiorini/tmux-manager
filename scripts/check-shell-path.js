#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmux-manager-shell-path-'));

childProcess.execFileSync(
  path.join(root, 'node_modules', '.bin', 'tsc'),
  [
    path.join(root, 'src/services/shellPath.ts'),
    '--target', 'ES2020',
    '--module', 'commonjs',
    '--types', 'node',
    '--outDir', outDir
  ],
  { stdio: 'inherit' }
);

const shellPath = require(path.join(outDir, 'shellPath.js'));

assert.strictEqual(
  shellPath.withLocalCommonBinPaths('echo ok', 'win32'),
  'echo ok',
  'Windows local commands must not be wrapped with POSIX shell syntax'
);

const localWrapped = shellPath.withLocalCommonBinPaths('command -v tmux', 'darwin');
assert(localWrapped.startsWith('export PATH="'), 'POSIX local commands should export PATH first');
assert(localWrapped.includes('/opt/homebrew/bin'), 'macOS Homebrew path should be included');
assert(localWrapped.includes('/usr/local/bin'), 'Intel Homebrew path should be included');
assert(localWrapped.includes('/home/linuxbrew/.linuxbrew/bin'), 'Linuxbrew path should be included');
assert(localWrapped.endsWith('; command -v tmux'), 'Original command should be preserved at the end');

const sshWrapped = shellPath.withPosixCommonBinPaths('tmux -V');
assert(sshWrapped.includes('/opt/homebrew/bin'), 'SSH wrapper should include Homebrew path');
assert(sshWrapped.endsWith('; tmux -V'), 'SSH wrapper should preserve original command');

assert.strictEqual(shellPath.shellQuote("ai-clients"), "'ai-clients'");
assert.strictEqual(shellPath.shellQuote("team's session"), "'team'\\''s session'");

const attachCommand = shellPath.buildSshTerminalCommand(
  {
    username: 'stefano',
    host: '192.168.254.80',
    port: 22,
    authType: 'password',
    privateKeyPath: '/tmp/stale-key',
  },
  "tmux attach-session -t 'ai-clients'"
);
assert(
  attachCommand.includes("'export PATH=\"/opt/homebrew/bin:/usr/local/bin:/opt/local/bin:/home/linuxbrew/.linuxbrew/bin:/snap/bin:$PATH\"; tmux attach-session -t '\\''ai-clients'\\'''"),
  `SSH attach command should quote remote PATH-wrapped command safely: ${attachCommand}`
);
assert(
  !attachCommand.includes('"tmux attach-session -t "ai-clients""'),
  'SSH attach command must not use broken nested double quotes'
);
assert(!attachCommand.includes(' -i '), 'Password auth attach command should ignore stale privateKeyPath');

const privateKeyAttachCommand = shellPath.buildSshTerminalCommand(
  {
    username: 'stefano',
    host: '192.168.254.80',
    port: 22,
    authType: 'privateKey',
    privateKeyPath: '/Users/stefano/.ssh/id ed25519',
  },
  "tmux attach-session -t 'ai-clients'"
);
assert(
  privateKeyAttachCommand.includes("-i '/Users/stefano/.ssh/id ed25519'"),
  `Private-key attach command should include quoted -i path: ${privateKeyAttachCommand}`
);


console.log('Shell PATH command wrappers behave as expected.');
