export interface BroadcasterConfig {
    hubUrl: string;
    token?: string | (() => string | null);
}

export type EventCallback = (data: any) => void;

/**
 * Represents a communication channel (Public or Private)
 */
class TonkaChannel {
    private eventSource: EventSource | null = null;
    private listeners: Map<string, EventCallback[]> = new Map();

    constructor(
        private hubUrl: string,
        private channelName: string,
        private token?: string
    ) {
        this.connect();
    }

    /**
     * Initializes the EventSource (SSE) connection
     */
    private connect(): void {
        const url = new URL(this.hubUrl);
        // Standardized topic format for Tonka
        const topicUrl = `https://tonka.framework/channels/${this.channelName}`;
        url.searchParams.append('topic', topicUrl);

        // If Mercure is configured to accept the token as a query parameter
        if (this.token) {
            url.searchParams.append('authorization', `Bearer ${this.token}`);
        }

        this.eventSource = new EventSource(url.toString());

        this.eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                // Mercure often sends the event name inside the structure or uses the type
                const eventName = payload.event || 'default';
                const data = payload.data || payload;

                // Dispatch the event to the corresponding listeners
                const callbacks = this.listeners.get(eventName);
                if (callbacks) {
                    callbacks.forEach(callback => callback(data));
                }
                
                // Also dispatch to the global listener if present
                const globalCallbacks = this.listeners.get('*');
                if (globalCallbacks) {
                    globalCallbacks.forEach(callback => callback(payload));
                }
            } catch (error) {
                console.error("Error parsing Mercure event:", error);
            }
        };

        this.eventSource.onerror = (err) => {
            console.error(`SSE connection error on channel [${this.channelName}]:`, err);
        };
    }

    /**
     * Listens for a specific event on this channel
     */
    public listen(eventName: string, callback: EventCallback): this {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName)!.push(callback);
        return this;
    }

    /**
     * Cleanly closes the connection
     */
    public close(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.listeners.clear();
    }
}

/**
 * Main Broadcaster Manager
 */
export default class TonkaBroadcaster {
    private hubUrl: string;
    private tokenResolver?: string | (() => string | null);
    private activeChannels: Map<string, TonkaChannel> = new Map();

    constructor(config: BroadcasterConfig) {
        this.hubUrl = config.hubUrl;
        this.tokenResolver = config.token;
    }

    /**
     * Resolves the token (whether it is a string or a callback function)
     */
    private resolveToken(): string | undefined {
        if (typeof this.tokenResolver === 'function') {
            return this.tokenResolver() || undefined;
        }
        return this.tokenResolver;
    }

    /**
     * Joins a public channel
     */
    public channel(channelName: string): TonkaChannel {
        if (!this.activeChannels.has(channelName)) {
            const channel = new TonkaChannel(this.hubUrl, channelName);
            this.activeChannels.set(channelName, channel);
        }
        return this.activeChannels.get(channelName)!;
    }

    /**
     * Joins a private channel secured by JWT
     */
    public private(channelName: string): TonkaChannel {
        const privateName = `private.${channelName}`;
        
        if (!this.activeChannels.has(privateName)) {
            const token = this.resolveToken();
            const channel = new TonkaChannel(this.hubUrl, privateName, token);
            this.activeChannels.set(privateName, channel);
        }
        return this.activeChannels.set(privateName, this.activeChannels.get(privateName)!) && this.activeChannels.get(privateName)!;
    }

    /**
     * Leaves a channel and frees up resources
     */
    public leave(channelName: string): void {
        // Check both variants (public or private)
        const targets = [channelName, `private.${channelName}`];
        
        targets.forEach(target => {
            if (this.activeChannels.has(target)) {
                this.activeChannels.get(target)!.close();
                this.activeChannels.delete(target);
            }
        });
    }
}