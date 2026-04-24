const COMMON_BIN_PATHS = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/opt/local/bin',
    '/home/linuxbrew/.linuxbrew/bin',
    '/snap/bin'
];

export function commonBinPathPrefix(): string {
    return COMMON_BIN_PATHS.join(':');
}

/** Quote a value for POSIX shells. Do not use this for cmd.exe or PowerShell. */
export function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Prepend common package-manager binary directories for POSIX shells.
 *
 * SSH exec sessions and GUI-launched editor extension hosts often receive a
 * minimal PATH that omits Homebrew/MacPorts/Linuxbrew/Snap locations, causing
 * tmux discovery to fail even when tmux is installed.
 */
export function withPosixCommonBinPaths(command: string): string {
    return `export PATH="${commonBinPathPrefix()}:$PATH"; ${command}`;
}

/**
 * Add common binary paths for local commands where the shell supports POSIX
 * syntax. Windows local execution uses cmd.exe/PowerShell semantics and must
 * not receive POSIX `export PATH=...` syntax.
 */
export function withLocalCommonBinPaths(
    command: string,
    platform: NodeJS.Platform = process.platform
): string {
    if (platform === 'win32') {
        return command;
    }

    // Non-Windows local shells use the same POSIX syntax as SSH commands.
    return withPosixCommonBinPaths(command);
}

export interface SshTerminalCommandOptions {
    username: string;
    host: string;
    port: number;
    authType?: 'password' | 'privateKey';
    privateKeyPath?: string;
}

function buildSshCommandParts(options: SshTerminalCommandOptions): string[] {
    const parts = [
        'ssh',
        '-t',
        '-p',
        String(options.port)
    ];

    if (options.authType === 'privateKey' && options.privateKeyPath) {
        parts.push('-i', shellQuote(options.privateKeyPath));
    }

    parts.push(shellQuote(`${options.username}@${options.host}`));
    return parts;
}

export function buildSshTerminalCommand(
    options: SshTerminalCommandOptions,
    remoteCommand: string
): string {
    return [
        ...buildSshCommandParts(options),
        shellQuote(withPosixCommonBinPaths(remoteCommand))
    ].join(' ');
}

