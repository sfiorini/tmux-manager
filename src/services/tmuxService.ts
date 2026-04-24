import { ConnectionManager } from './connectionManager';
import { shellQuote } from './shellPath';
import { TmuxSession, TmuxWindow, TmuxPane } from '../types/tmux';

/**
 * Tmux service
 * Wraps all tmux-related operations
 */
export class TmuxService {
    private connectionManager: ConnectionManager;

    constructor(connectionManager: ConnectionManager) {
        this.connectionManager = connectionManager;
    }

    /**
     * Check whether tmux is available
     */
    async isTmuxAvailable(connectionId: string): Promise<boolean> {
        try {
            const result = await this.connectionManager.execute(connectionId, 'which tmux');
            return result.exitCode === 0 && result.stdout.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Get all sessions
     */
    async listSessions(connectionId: string): Promise<TmuxSession[]> {
        const format = '#{session_id}:#{session_name}:#{session_attached}:#{session_windows}:#{session_created}';
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux list-sessions -F "${format}" 2>/dev/null`
        );

        if (result.exitCode !== 0 || !result.stdout) {
            return [];
        }

        const sessions: TmuxSession[] = [];
        const lines = result.stdout.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 4) {
                const session: TmuxSession = {
                    id: parts[0],
                    name: parts[1],
                    attached: parts[2] === '1',
                    windowCount: parseInt(parts[3], 10) || 0,
                    windows: [],
                    connectionId
                };

                if (parts[4]) {
                    session.createdAt = new Date(parseInt(parts[4], 10) * 1000);
                }

                sessions.push(session);
            }
        }

        return sessions;
    }

    /**
     * Get all windows for a session
     */
    async listWindows(connectionId: string, sessionName: string): Promise<TmuxWindow[]> {
        const format = '#{window_id}:#{window_index}:#{window_name}:#{window_active}';
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux list-windows -t "${sessionName}" -F "${format}" 2>/dev/null`
        );

        if (result.exitCode !== 0 || !result.stdout) {
            return [];
        }

        const windows: TmuxWindow[] = [];
        const lines = result.stdout.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 4) {
                windows.push({
                    id: parts[0],
                    index: parseInt(parts[1], 10) || 0,
                    name: parts[2],
                    active: parts[3] === '1',
                    panes: [],
                    sessionName,
                    connectionId
                });
            }
        }

        return windows;
    }

    /**
     * Get all panes for a window
     */
    async listPanes(connectionId: string, sessionName: string, windowId: string): Promise<TmuxPane[]> {
        const format = '#{pane_id}:#{pane_index}:#{pane_active}:#{pane_current_path}:#{pane_current_command}:#{pane_width}:#{pane_height}';
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux list-panes -t "${sessionName}:${windowId}" -F "${format}" 2>/dev/null`
        );

        if (result.exitCode !== 0 || !result.stdout) {
            return [];
        }

        const panes: TmuxPane[] = [];
        const lines = result.stdout.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 7) {
                panes.push({
                    id: parts[0],
                    index: parseInt(parts[1], 10) || 0,
                    active: parts[2] === '1',
                    currentPath: parts[3] || '~',
                    currentCommand: parts[4] || '',
                    width: parseInt(parts[5], 10) || 0,
                    height: parseInt(parts[6], 10) || 0,
                    windowId,
                    sessionName,
                    connectionId
                });
            }
        }

        return panes;
    }

    /**
     * Get full session tree (including windows and panes)
     */
    async getSessionTree(connectionId: string): Promise<TmuxSession[]> {
        const sessions = await this.listSessions(connectionId);

        for (const session of sessions) {
            session.windows = await this.listWindows(connectionId, session.name);
            
            for (const window of session.windows) {
                // Use window index to get panes
                window.panes = await this.listPanes(connectionId, session.name, String(window.index));
            }
        }

        return sessions;
    }

    /**
     * Create new session
     */
    async createSession(connectionId: string, name?: string): Promise<TmuxSession | null> {
        let command = 'tmux new-session -d -c "$HOME"';
        if (name) {
            command += ` -s ${shellQuote(name)}`;
        }

        const result = await this.connectionManager.execute(connectionId, command);
        
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to create session');
        }

        // Get newly created session
        const sessions = await this.listSessions(connectionId);
        if (name) {
            return sessions.find(s => s.name === name) || null;
        }
        // Return newest session
        return sessions[sessions.length - 1] || null;
    }

    /**
     * Delete session
     */
    async killSession(connectionId: string, sessionName: string): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux kill-session -t "${sessionName}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to delete session');
        }
    }

    /**
     * Rename session
     */
    async renameSession(connectionId: string, oldName: string, newName: string): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux rename-session -t "${oldName}" "${newName}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to rename session');
        }
    }

    /**
     * Create new window
     */
    async createWindow(connectionId: string, sessionName: string, windowName?: string): Promise<void> {
        const startDirectory = await this.getNewWindowStartDirectory(connectionId, sessionName);
        let command = `tmux new-window -t ${shellQuote(sessionName)} -c ${startDirectory}`;
        if (windowName) {
            command += ` -n ${shellQuote(windowName)}`;
        }

        const result = await this.connectionManager.execute(connectionId, command);

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to create window');
        }
    }

    private async getNewWindowStartDirectory(connectionId: string, sessionName: string): Promise<string> {
        // A session target resolves to the active pane of the active window, which is
        // the least surprising starting directory for a newly created window.
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux display-message -p -t ${shellQuote(sessionName)} '#{pane_current_path}' 2>/dev/null`
        );

        const currentPath = result.exitCode === 0 ? result.stdout.trim() : '';
        if (!currentPath || currentPath === '/') {
            return '"$HOME"';
        }

        return shellQuote(currentPath);
    }

    /**
     * Delete window
     */
    async killWindow(connectionId: string, sessionName: string, windowIndex: number): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux kill-window -t "${sessionName}:${windowIndex}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to delete window');
        }
    }

    /**
     * Rename window
     */
    async renameWindow(
        connectionId: string, 
        sessionName: string, 
        windowIndex: number, 
        newName: string
    ): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux rename-window -t "${sessionName}:${windowIndex}" "${newName}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to rename window');
        }
    }

    /**
     * Switch to window
     */
    async selectWindow(connectionId: string, sessionName: string, windowIndex: number): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux select-window -t "${sessionName}:${windowIndex}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to switch window');
        }
    }

    /**
     * Split pane horizontally
     */
    async splitPaneHorizontal(connectionId: string, target: string): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux split-window -h -t "${target}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to split pane horizontally');
        }
    }

    /**
     * Split pane vertically
     */
    async splitPaneVertical(connectionId: string, target: string): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux split-window -v -t "${target}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to split pane vertically');
        }
    }

    /**
     * Close pane
     */
    async killPane(connectionId: string, paneId: string): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux kill-pane -t "${paneId}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to close pane');
        }
    }

    /**
     * Switch to specified pane
     */
    async selectPane(connectionId: string, paneId: string): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux select-pane -t "${paneId}"`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to switch pane');
        }
    }

    /**
     * Swap pane position
     * direction: U(previous), D(next)
     */
    async swapPane(connectionId: string, paneId: string, direction: 'U' | 'D'): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux swap-pane -t "${paneId}" -${direction}`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to swap pane');
        }
    }

    /**
     * Resize pane
     * direction: U(up), D(down), L(left), R(right)
     * amount: number of rows/columns to resize
     */
    async resizePane(connectionId: string, paneId: string, direction: 'U' | 'D' | 'L' | 'R', amount: number = 5): Promise<void> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux resize-pane -t "${paneId}" -${direction} ${amount}`
        );

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || 'Failed to resize pane');
        }
    }

    /**
     * Attach to session (generate tmux attach command)
     */
    getAttachCommand(sessionName: string): string {
        return `tmux attach-session -t ${shellQuote(sessionName)}`;
    }

    /**
     * Check whether mouse mode is enabled
     */
    async isMouseModeEnabled(connectionId: string): Promise<boolean> {
        const result = await this.connectionManager.execute(
            connectionId,
            `tmux show-options -g mouse 2>/dev/null | grep -q "on" && echo "enabled" || echo "disabled"`
        );
        return result.stdout.trim() === 'enabled';
    }

    /**
     * Toggle mouse mode (smart toggle)
     * Detect current state and toggle it while updating ~/.tmux.conf
     */
    async toggleMouseMode(connectionId: string): Promise<boolean> {
        const isEnabled = await this.isMouseModeEnabled(connectionId);
        
        if (isEnabled) {
            await this.disableMouseMode(connectionId);
            return false;
        } else {
            await this.enableMouseMode(connectionId);
            return true;
        }
    }

    /**
     * Enable mouse mode
     * Update ~/.tmux.conf and reload configuration
     */
    async enableMouseMode(connectionId: string): Promise<void> {
        // Check whether config file contains "set -g mouse on"
        const checkResult = await this.connectionManager.execute(
            connectionId,
            `grep -q "^set.*-g.*mouse.*on" ~/.tmux.conf 2>/dev/null && echo "exists" || echo "not_exists"`
        );

        // Add to file if config is missing
        if (checkResult.stdout.trim() === 'not_exists') {
            const addResult = await this.connectionManager.execute(
                connectionId,
                `echo "set -g mouse on" >> ~/.tmux.conf`
            );

            if (addResult.exitCode !== 0) {
                throw new Error(addResult.stderr || 'Failed to add configuration');
            }
        }

        // Reload tmux configuration
        await this.connectionManager.execute(
            connectionId,
            `tmux source-file ~/.tmux.conf 2>/dev/null || true`
        );

        // Immediately set mouse mode for current tmux sessions
        await this.connectionManager.execute(
            connectionId,
            `tmux set-option -g mouse on 2>/dev/null || true`
        );
    }

    /**
     * Disable mouse mode
     */
    async disableMouseMode(connectionId: string): Promise<void> {
        // Remove mouse on setting from config file
        await this.connectionManager.execute(
            connectionId,
            `sed -i '/^set.*-g.*mouse.*on/d' ~/.tmux.conf 2>/dev/null || true`
        );

        // Immediately disable mouse mode for current tmux sessions
        await this.connectionManager.execute(
            connectionId,
            `tmux set-option -g mouse off 2>/dev/null || true`
        );
    }
}

