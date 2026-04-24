import * as vscode from 'vscode';
import { TmuxService } from '../services/tmuxService';
import { ConnectionManager } from '../services/connectionManager';

/**
 * Status bar provider
 * Displays current active tmux session information
 */
export class StatusBarProvider {
    private statusBarItem: vscode.StatusBarItem;
    private tmuxService: TmuxService;
    private connectionManager: ConnectionManager;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor(
        tmuxService: TmuxService,
        connectionManager: ConnectionManager
    ) {
        this.tmuxService = tmuxService;
        this.connectionManager = connectionManager;

        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'tmuxManager.quickAttach';
        this.statusBarItem.tooltip = vscode.l10n.t('Click to attach session to terminal');
    }

    /**
     * Show status bar
     */
    show(): void {
        this.statusBarItem.show();
        this.startAutoUpdate();
    }

    /**
     * Hide status bar
     */
    hide(): void {
        this.statusBarItem.hide();
        this.stopAutoUpdate();
    }

    /**
     * Start automatic updates
     */
    startAutoUpdate(): void {
        this.update();
        this.updateInterval = setInterval(() => this.update(), 5000);
    }

    /**
     * Stop automatic updates
     */
    stopAutoUpdate(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Update status bar content
     */
    async update(): Promise<void> {
        try {
            // Get local tmux sessions
            const sessions = await this.tmuxService.listSessions('local');
            
            if (sessions.length === 0) {
                this.statusBarItem.text = '$(terminal) tmux: -';
                this.statusBarItem.tooltip = vscode.l10n.t('No active tmux sessions');
                return;
            }

            // Count session information
            const attachedSessions = sessions.filter(s => s.attached);
            const totalWindows = sessions.reduce((sum, s) => sum + s.windowCount, 0);

            if (attachedSessions.length > 0) {
                // Show attached session
                const session = attachedSessions[0];
                this.statusBarItem.text = `$(terminal) ${session.name}`;
                this.statusBarItem.tooltip = vscode.l10n.t(
                    '{0} sessions, {1} windows (attached: {2})',
                    sessions.length,
                    totalWindows,
                    session.name
                );
            } else {
                // Show session totals
                this.statusBarItem.text = `$(terminal) tmux: ${sessions.length}`;
                this.statusBarItem.tooltip = vscode.l10n.t(
                    '{0} sessions, {1} windows',
                    sessions.length,
                    totalWindows
                );
            }
        } catch (error) {
            this.statusBarItem.text = '$(terminal) tmux';
            this.statusBarItem.tooltip = vscode.l10n.t('Click to open TMUX Manager sidebar');
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.stopAutoUpdate();
        this.statusBarItem.dispose();
    }
}

