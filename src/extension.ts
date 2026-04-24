import * as vscode from 'vscode';
import { ConnectionManager } from './services/connectionManager';
import { TmuxService } from './services/tmuxService';
import { TmuxTreeProvider } from './providers/tmuxTreeProvider';
import { StatusBarProvider } from './providers/statusBarProvider';
import { registerCommands } from './commands';

let connectionManager: ConnectionManager;
let tmuxService: TmuxService;
let treeProvider: TmuxTreeProvider;
let statusBarProvider: StatusBarProvider;

/**
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): void {
    // Initialize connection manager
    connectionManager = new ConnectionManager(context);

    // Initialize Tmux service
    tmuxService = new TmuxService(connectionManager);

    // Initialize tree data provider
    treeProvider = new TmuxTreeProvider(connectionManager, tmuxService);

    // Initialize status bar provider
    statusBarProvider = new StatusBarProvider(tmuxService, connectionManager);
    statusBarProvider.show();

    // Register tree view
    const treeView = vscode.window.createTreeView('tmuxManager.sessions', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
        canSelectMany: true  // Enable multi-select with Ctrl+Click and Shift+Click
    });

    context.subscriptions.push(treeView);

    // Register all commands
    registerCommands(context, connectionManager, tmuxService, treeProvider);

    // Listen for view visibility changes and only auto-refresh while visible
    treeView.onDidChangeVisibility(e => {
        if (e.visible) {
            treeProvider.startAutoRefresh();
        } else {
            treeProvider.stopAutoRefresh();
        }
    });

    // Register cleanup
    context.subscriptions.push({
        dispose: () => {
            treeProvider.dispose();
            statusBarProvider.dispose();
            connectionManager.dispose();
        }
    });
}

/**
 * Called when the extension is deactivated
 */
export function deactivate(): void {
    if (treeProvider) {
        treeProvider.dispose();
    }

    if (statusBarProvider) {
        statusBarProvider.dispose();
    }
    
    if (connectionManager) {
        connectionManager.dispose();
    }
}

