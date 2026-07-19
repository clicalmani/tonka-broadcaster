import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TonkaBroadcaster from '../index';

// 1. EventSource Mock Creation
class MockEventSource {
    url: string;
    onmessage: ((event: any) => void) | null = null;
    onerror: ((err: any) => void) | null = null;
    close = vi.fn();

    constructor(url: string) {
        this.url = url;
        // Store the instance to simulate events within the tests
        MockEventSource.instances.push(this);
    }

    static instances: MockEventSource[] = [];
    static emit(data: any) {
        const lastInstance = MockEventSource.instances[MockEventSource.instances.length - 1];
        if (lastInstance && lastInstance.onmessage) {
            lastInstance.onmessage({ data: JSON.stringify(data) });
        }
    }
    static emitError(err: any) {
        const lastInstance = MockEventSource.instances[MockEventSource.instances.length - 1];
        if (lastInstance && lastInstance.onerror) {
            lastInstance.onerror(err);
        }
    }
}

describe('TonkaBroadcaster', () => {
    const hubUrl = 'http://localhost:3000/.well-known/mercure';

    beforeEach(() => {
        MockEventSource.instances = [];
        // Replace the browser's global EventSource with our Mock
        vi.stubGlobal('EventSource', MockEventSource);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should initialize a public channel with the correct topic', () => {
        const broadcaster = new TonkaBroadcaster({ hubUrl });
        
        // Join a channel
        broadcaster.channel('chat');

        expect(MockEventSource.instances.length).toBe(1);
        const instantiatedUrl = new URL(MockEventSource.instances[0].url);
        
        // Verify the target Mercure URL and the Tonka topic
        expect(instantiatedUrl.origin + instantiatedUrl.pathname).toBe(hubUrl);
        expect(instantiatedUrl.searchParams.get('topic')).toBe('https://tonka.framework/channels/chat');
    });

    it('should inject the JWT token into the URL for private channels', () => {
        const token = 'my-secret-jwt-token';
        const broadcaster = new TonkaBroadcaster({
            hubUrl,
            token: () => token // Dynamic resolution
        });

        broadcaster.private('dashboard');

        const instantiatedUrl = new URL(MockEventSource.instances[0].url);
        expect(instantiatedUrl.searchParams.get('topic')).toBe('https://tonka.framework/channels/private.dashboard');
        expect(instantiatedUrl.searchParams.get('authorization')).toBe(`Bearer ${token}`);
    });

    it('should trigger the correct listener upon receiving a message', () => {
        const broadcaster = new TonkaBroadcaster({ hubUrl });
        const callback = vi.fn();

        broadcaster.channel('orders').listen('OrderPlaced', callback);

        // Simulate a message dispatched by the Mercure Hub
        const mockPayload = {
            event: 'OrderPlaced',
            data: { id: 42, total: 1500 }
        };
        MockEventSource.emit(mockPayload);

        // Verifications
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith({ id: 42, total: 1500 });
    });

    it('should reuse the same connection if subscribing twice to the same channel (Multiton pattern)', () => {
        const broadcaster = new TonkaBroadcaster({ hubUrl });

        // Two subscriptions to the same channel
        broadcaster.channel('notifications');
        broadcaster.channel('notifications');

        // Only a single EventSource instance should be created on the network side
        expect(MockEventSource.instances.length).toBe(1);
    });

    it('should cleanly close the network connection when calling leave()', () => {
        const broadcaster = new TonkaBroadcaster({ hubUrl });
        
        broadcaster.channel('crypto');
        expect(MockEventSource.instances.length).toBe(1);

        const currentMockInstance = MockEventSource.instances[0];
        
        // Leave the channel
        broadcaster.leave('crypto');

        // The native close method of EventSource must have been called
        expect(currentMockInstance.close).toHaveBeenCalledTimes(1);
    });
});