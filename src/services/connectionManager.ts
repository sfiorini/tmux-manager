import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { Client, ConnectConfig } from 'ssh2';
import { Connection, SSHConnectionConfig, CommandResult } from '../types/tmux';
import { withLocalCommonBinPaths, withPosixCommonBinPaths } from './shellPath';

const execAsync = promisify(exec);

/**
 * Command executor interface
 */
export interface CommandExecutor {
    execute(command: string): Promise<CommandResult>;
    dispose(): void;
}

/**
 * Local command executor
 */
export class LocalExecutor implements CommandExecutor {
    async execute(command: string): Promise<CommandResult> {
        try {
            const { stdout, stderr } = await execAsync(withLocalCommonBinPaths(command));
            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0
            };
        } catch (error: unknown) {
            const err = error as { stdout?: string; stderr?: string; code?: number };
            return {
                stdout: err.stdout?.trim() || '',
                stderr: err.stderr?.trim() || String(error),
                exitCode: err.code || 1
            };
        }
    }

    dispose(): void {
        // Local executor requires no cleanup
    }
}

/**
 * SSH command executor
 */
export class SSHExecutor implements CommandExecutor {
    private client: Client | null = null;
    private connected = false;
    private config: SSHConnectionConfig;

    constructor(config: SSHConnectionConfig) {
        this.config = config;
    }

    async connect(): Promise<void> {
        if (this.connected && this.client) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.client = new Client();

            const connectConfig: ConnectConfig = {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
            };

            if (this.config.authType === 'password') {
                connectConfig.password = this.config.password;
            } else if (this.config.authType === 'privateKey') {
                // Read private key file
                const fs = require('fs');
                try {
                    connectConfig.privateKey = fs.readFileSync(this.config.privateKeyPath!);
                    if (this.config.passphrase) {
                        connectConfig.passphrase = this.config.passphrase;
                    }
                } catch (err) {
                    reject(new Error(`Unable to read private key file: ${this.config.privateKeyPath}`));
                    return;
                }
            }

            this.client.on('ready', () => {
                this.connected = true;
                resolve();
            });

            this.client.on('error', (err) => {
                this.connected = false;
                reject(err);
            });

            this.client.on('close', () => {
                this.connected = false;
            });

            this.client.connect(connectConfig);
        });
    }

    async execute(command: string): Promise<CommandResult> {
        if (!this.connected || !this.client) {
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            this.client!.exec(withPosixCommonBinPaths(command), (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }

                let stdout = '';
                let stderr = '';

                stream.on('data', (data: Buffer) => {
                    stdout += data.toString();
                });

                stream.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString();
                });

                stream.on('close', (code: number) => {
                    resolve({
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: code || 0
                    });
                });
            });
        });
    }

    dispose(): void {
        if (this.client) {
            this.client.end();
            this.client = null;
            this.connected = false;
        }
    }
}

/**
 * Connection manager
 * Manage local and SSH connections
 */
export class ConnectionManager {
    private connections: Map<string, Connection> = new Map();
    private executors: Map<string, CommandExecutor> = new Map();
    private context: vscode.ExtensionContext;
    private secrets: vscode.SecretStorage;

    private static readonly LOCAL_CONNECTION_ID = 'local';
    private static readonly CONNECTIONS_STORAGE_KEY = 'tmuxManager.connections';
    private static readonly PASSWORD_PREFIX = 'tmuxManager.ssh.password.';
    private static readonly PASSPHRASE_PREFIX = 'tmuxManager.ssh.passphrase.';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.secrets = context.secrets;
        this.initializeLocalConnection();
        this.loadConnections();
    }

    private initializeLocalConnection(): void {
        const localConnection: Connection = {
            id: ConnectionManager.LOCAL_CONNECTION_ID,
            type: 'local',
            name: vscode.l10n.t('Local')
        };
        this.connections.set(localConnection.id, localConnection);
        this.executors.set(localConnection.id, new LocalExecutor());
    }

    private loadConnections(): void {
        const savedConnections = this.context.globalState.get<Connection[]>(
            ConnectionManager.CONNECTIONS_STORAGE_KEY,
            []
        );

        for (const conn of savedConnections) {
            if (conn.type === 'ssh' && conn.config) {
                this.connections.set(conn.id, conn);
                // Create SSH executor lazily only when needed
            }
        }
    }

    private saveConnections(): void {
        const sshConnections = Array.from(this.connections.values())
            .filter(c => c.type === 'ssh');
        
        // Do not save passwords, only non-sensitive information
        const safeConnections = sshConnections.map(c => ({
            ...c,
            config: c.config ? {
                ...c.config,
                password: undefined,  // Do not save password
                passphrase: undefined // Do not save key passphrase
            } : undefined
        }));

        this.context.globalState.update(
            ConnectionManager.CONNECTIONS_STORAGE_KEY,
            safeConnections
        );
    }

    /**
     * Get all connections
     */
    getAllConnections(): Connection[] {
        return Array.from(this.connections.values());
    }

    /**
     * Get connection
     */
    getConnection(id: string): Connection | undefined {
        return this.connections.get(id);
    }

    /**
     * Add SSH connection
     */
    async addSSHConnection(config: SSHConnectionConfig): Promise<Connection> {
        // Securely store password
        if (config.password) {
            await this.secrets.store(
                ConnectionManager.PASSWORD_PREFIX + config.id,
                config.password
            );
        }

        // Securely store private-key passphrase
        if (config.passphrase) {
            await this.secrets.store(
                ConnectionManager.PASSPHRASE_PREFIX + config.id,
                config.passphrase
            );
        }

        const connection: Connection = {
            id: config.id,
            type: 'ssh',
            name: config.name || `${config.username}@${config.host}`,
            config
        };

        this.connections.set(connection.id, connection);
        this.saveConnections();

        return connection;
    }

    /**
     * Get stored password
     */
    async getStoredPassword(connectionId: string): Promise<string | undefined> {
        return this.secrets.get(ConnectionManager.PASSWORD_PREFIX + connectionId);
    }

    /**
     * Get stored private-key passphrase
     */
    async getStoredPassphrase(connectionId: string): Promise<string | undefined> {
        return this.secrets.get(ConnectionManager.PASSPHRASE_PREFIX + connectionId);
    }

    /**
     * Update SSH connection
     */
    async updateSSHConnection(config: SSHConnectionConfig): Promise<void> {
        const existing = this.connections.get(config.id);
        if (!existing || existing.type !== 'ssh') {
            throw new Error('Connection does not exist');
        }

        // Disconnect old connection
        const oldExecutor = this.executors.get(config.id);
        if (oldExecutor) {
            oldExecutor.dispose();
            this.executors.delete(config.id);
        }

        const connection: Connection = {
            id: config.id,
            type: 'ssh',
            name: config.name || `${config.username}@${config.host}`,
            config
        };

        this.connections.set(connection.id, connection);
        this.saveConnections();
    }

    /**
     * Remove connection
     */
    async removeConnection(id: string): Promise<void> {
        if (id === ConnectionManager.LOCAL_CONNECTION_ID) {
            throw new Error('Cannot remove local connection');
        }

        const executor = this.executors.get(id);
        if (executor) {
            executor.dispose();
            this.executors.delete(id);
        }

        // Clear stored password
        await this.secrets.delete(ConnectionManager.PASSWORD_PREFIX + id);
        await this.secrets.delete(ConnectionManager.PASSPHRASE_PREFIX + id);

        this.connections.delete(id);
        this.saveConnections();
    }

    /**
     * Get executor
     */
    async getExecutor(connectionId: string): Promise<CommandExecutor> {
        // Return existing executor if present
        const existing = this.executors.get(connectionId);
        if (existing) {
            return existing;
        }

        // Create a new executor
        const connection = this.connections.get(connectionId);
        if (!connection) {
            throw new Error(`Connection does not exist: ${connectionId}`);
        }

        if (connection.type === 'local') {
            const executor = new LocalExecutor();
            this.executors.set(connectionId, executor);
            return executor;
        }

        if (connection.type === 'ssh' && connection.config) {
            // Get password from SecretStorage
            const config = { ...connection.config };
            
            if (config.authType === 'password' && !config.password) {
                const storedPassword = await this.getStoredPassword(connectionId);
                if (storedPassword) {
                    config.password = storedPassword;
                }
            }

            if (config.authType === 'privateKey' && !config.passphrase) {
                const storedPassphrase = await this.getStoredPassphrase(connectionId);
                if (storedPassphrase) {
                    config.passphrase = storedPassphrase;
                }
            }

            const executor = new SSHExecutor(config);
            await executor.connect();
            this.executors.set(connectionId, executor);
            return executor;
        }

        throw new Error(`Unable to create executor: ${connectionId}`);
    }

    /**
     * Execute command
     */
    async execute(connectionId: string, command: string): Promise<CommandResult> {
        const executor = await this.getExecutor(connectionId);
        return executor.execute(command);
    }

    /**
     * Test connection
     */
    async testConnection(connectionId: string): Promise<boolean> {
        try {
            const result = await this.execute(connectionId, 'echo "test"');
            return result.exitCode === 0;
        } catch {
            return false;
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        for (const executor of this.executors.values()) {
            executor.dispose();
        }
        this.executors.clear();
    }
}

