import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * SSH config host information
 */
export interface SSHConfigHost {
    host: string;           // Alias
    hostname?: string;      // Actual host address
    user?: string;          // Username
    port?: number;          // Port
    identityFile?: string;  // Private key file path
}

/**
 * Parse SSH config file
 */
export class SSHConfigParser {
    private configPath: string;

    constructor(configPath?: string) {
        this.configPath = configPath || path.join(os.homedir(), '.ssh', 'config');
    }

    /**
     * Parse SSH config file and return host list
     */
    async parse(): Promise<SSHConfigHost[]> {
        try {
            if (!fs.existsSync(this.configPath)) {
                return [];
            }

            const content = await fs.promises.readFile(this.configPath, 'utf-8');
            return this.parseContent(content);
        } catch (error) {
            console.error('Failed to parse SSH config:', error);
            return [];
        }
    }

    /**
     * Parse config file content
     */
    private parseContent(content: string): SSHConfigHost[] {
        const hosts: SSHConfigHost[] = [];
        const lines = content.split('\n');
        
        let currentHost: SSHConfigHost | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            // Parse key-value pairs
            const match = trimmed.match(/^(\S+)\s+(.+)$/);
            if (!match) {
                continue;
            }

            const [, key, value] = match;
            const keyLower = key.toLowerCase();

            if (keyLower === 'host') {
                // Save previous host config
                if (currentHost && currentHost.host !== '*') {
                    hosts.push(currentHost);
                }
                
                // Start new host config (skip wildcards)
                if (value !== '*' && !value.includes('*')) {
                    currentHost = { host: value };
                } else {
                    currentHost = null;
                }
            } else if (currentHost) {
                switch (keyLower) {
                    case 'hostname':
                        currentHost.hostname = value;
                        break;
                    case 'user':
                        currentHost.user = value;
                        break;
                    case 'port':
                        currentHost.port = parseInt(value, 10);
                        break;
                    case 'identityfile':
                        // Expand ~ path
                        currentHost.identityFile = value.replace(/^~/, os.homedir());
                        break;
                }
            }
        }

        // Save last host config
        if (currentHost && currentHost.host !== '*') {
            hosts.push(currentHost);
        }

        return hosts;
    }
}

