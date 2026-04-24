/**
 * SSH connection configuration
 */
export interface SSHConnectionConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authType: 'password' | 'privateKey';
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
}

/**
 * Connection type
 */
export type ConnectionType = 'local' | 'ssh';

/**
 * Connection information
 */
export interface Connection {
    id: string;
    type: ConnectionType;
    name: string;
    config?: SSHConnectionConfig;
}

/**
 * Tmux pane
 */
export interface TmuxPane {
    id: string;           // Pane ID, e.g. %0
    index: number;        // Pane index
    active: boolean;      // Whether this is the active pane
    currentPath: string;  // Current working directory
    currentCommand: string; // Current running command
    width: number;
    height: number;
    // Parent information
    windowId: string;
    sessionName: string;
    connectionId: string;
}

/**
 * Tmux window
 */
export interface TmuxWindow {
    id: string;           // Window ID, e.g. @0
    index: number;        // Window index
    name: string;         // Window name
    active: boolean;      // Whether this is the active window
    panes: TmuxPane[];    // Pane list
    // Parent information
    sessionName: string;
    connectionId: string;
}

/**
 * Tmux session
 */
export interface TmuxSession {
    id: string;           // Session ID, e.g. $0
    name: string;         // Session name
    attached: boolean;    // Whether attached
    windows: TmuxWindow[]; // Window list
    windowCount: number;
    createdAt?: Date;
    // Parent information
    connectionId: string;
}

/**
 * Command execution result
 */
export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Tree item type
 */
export type TreeItemType = 'connection' | 'session' | 'window' | 'pane' | 'info';

/**
 * Tree item data
 */
export interface TreeNodeData {
    type: TreeItemType;
    connectionId: string;
    session?: TmuxSession;
    window?: TmuxWindow;
    pane?: TmuxPane;
}

