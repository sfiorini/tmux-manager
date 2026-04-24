# TMUX Manager

TMUX Manager is a VS Code/Cursor extension for managing local and remote tmux sessions from the activity bar. It gives you a tree view for connections, sessions, windows, and panes, while still letting tmux remain the source of truth.

## What it does

- Shows local and SSH tmux connections in one sidebar.
- Lists sessions, windows, and panes with refresh and auto-refresh support.
- Creates, renames, deletes, and attaches to tmux sessions.
- Creates, renames, switches, and deletes tmux windows.
- Splits, swaps, resizes, switches, and closes panes.
- Creates new sessions from either local or SSH connection nodes.
- Imports SSH host details from `~/.ssh/config`.
- Supports password and private-key SSH connections.
- Adds German and Italian localization in addition to English.

## Requirements

### Local tmux

Install `tmux` on the machine running VS Code/Cursor.

On macOS with Homebrew:

```bash
brew install tmux
```

### Remote tmux over SSH

Install `tmux` on each remote host and confirm SSH access works from your normal terminal:

```bash
ssh user@host 'tmux -V'
```

TMUX Manager automatically prepends common package-manager paths when it runs remote commands:

- `/opt/homebrew/bin`
- `/usr/local/bin`
- `/opt/local/bin`
- `/home/linuxbrew/.linuxbrew/bin`
- `/snap/bin`

This helps non-interactive SSH sessions find Homebrew, MacPorts, Linuxbrew, and Snap installations.

## Install for local testing

From the repository root:

```bash
npm ci
npm run install:cursor
```

`npm run install:cursor` builds the extension, packages `/tmp/tmux-manager-test.vsix`, and installs it into Cursor with `--force`. It is intended for macOS/Linux environments with the `cursor` CLI available; VS Code-only or Windows users can use the manual commands below.

Manual equivalent:

```bash
npm run build
npx @vscode/vsce package --out /tmp/tmux-manager-test.vsix
cursor --install-extension /tmp/tmux-manager-test.vsix --force
```

Reload Cursor after installation:

```text
Developer: Reload Window
```

For VS Code, package the VSIX and install it manually:

```bash
npm run build
npx @vscode/vsce package --out /tmp/tmux-manager-test.vsix
code --install-extension /tmp/tmux-manager-test.vsix --force
```

## Quick start

1. Open the TMUX Manager activity bar view.
2. Expand **Local** to inspect local tmux sessions.
3. Right-click **Local** or an SSH connection and choose **New Session**.
4. Enter a session name, or leave it empty for tmux to generate one.
5. Right-click a session to attach, rename, create a window, or delete it.
6. Right-click panes to split, resize, swap, close, or switch.

## SSH connections

Use **Add SSH Connection** from the TMUX Manager title bar. The extension can prefill hosts from `~/.ssh/config`, or you can enter host, port, username, and authentication details manually.

For SSH connections, passwords and private-key passphrases are stored in VS Code SecretStorage. Command execution uses those secrets through the extension's SSH client. Attach-to-terminal commands use your system `ssh`, so password-based terminal sessions may still prompt in the integrated terminal.

## Terminal behavior

- **New Session** is available by right-clicking **Local** or an SSH connection.
- **Attach to Terminal** opens an integrated terminal and attaches to the selected tmux session.
- For SSH sessions, the terminal command is wrapped as an SSH command and includes the managed PATH prefix so remote Homebrew/MacPorts/Linuxbrew/Snap tmux binaries can be found.
- New local tmux sessions start in `$HOME` instead of the macOS filesystem root.
- New tmux windows start in the active pane's current directory; if tmux reports `/` or no path, TMUX Manager falls back to `$HOME`.

## Commands and context menus

Common actions are available from the sidebar:

- Connection: create session, toggle mouse mode, edit/remove SSH connection.
- Session: attach, rename, create window, delete.
- Window: switch, rename, split, delete.
- Pane: switch, split, swap, resize, close.

The command namespace is `tmuxManager.*`.

## Development commands

```bash
npm ci
npm run build
npm run typecheck
npm run l10n:check
npm run shell-path:check
npx @vscode/vsce package --out /tmp/tmux-manager-test.vsix
```

Useful scripts:

- `npm run build` - bundle the extension.
- `npm run typecheck` - run TypeScript without emitting files.
- `npm run l10n:check` - verify localization keys/placeholders.
- `npm run shell-path:check` - verify shell/SSH command generation.
- `npm run install:cursor` - build, package, and install the VSIX into Cursor.

## Localization

The extension ships English base strings plus German and Italian translations:

- `package.nls.json`
- `package.nls.de.json`
- `package.nls.it.json`
- `l10n/bundle.l10n.json`
- `l10n/bundle.l10n.de.json`
- `l10n/bundle.l10n.it.json`

Chinese localization from the upstream project has been removed.

## Packaging and release notes

Marketplace publication is pending. Planned identifiers:

- VS Code Marketplace: `sfiorini.tmux-manager`
- Open VSX: `sfiorini/tmux-manager`

Before publishing, create the new GitHub repository, push this branch there, claim/configure the `sfiorini` Marketplace and Open VSX namespaces, and add `VSCE_TOKEN` and `OVSX_TOKEN` as GitHub Actions secrets. Only then run the manual `workflow_dispatch` publish workflow.

Production dependency audit at preparation time:

```bash
npm audit --omit=dev
```

reported zero production vulnerabilities. Development-tooling advisories should be triaged separately.

## Known limitations

- Connection storage is intentionally clean-slate under `tmuxManager.*`; upstream storage keys are not migrated.
- Service-layer technical error details are English, while user-facing command wrappers use VS Code localization.
- Password-auth attach terminals use system `ssh` and can prompt interactively.
- Remote attach commands are emitted for POSIX-compatible local integrated shells. On Windows, use a POSIX shell profile such as Git Bash/WSL for SSH attach commands.

## Release notes

See [CHANGELOG.md](CHANGELOG.md).

## Attribution

Based on Muxify by wangtao2001, MIT-licensed — https://github.com/wangtao2001/Muxify

## License

[MIT](LICENSE)
