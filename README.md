# Tonka Broadcaster 📡

Bring real-time, event-driven capabilities to your frontend application.

This package provides a seamless JavaScript client for the **[Tonka Framework](https://clicalmani.github.io/tonka)** broadcast system. Powered by **Mercure Hub**, it allows you to subscribe to public or private channels and listen for backend events in real-time, acting exactly like an echo system for your modern web apps.

## ✨ Features

* 🔄 **Real-Time Synchronization**: Instantly receive backend updates via Server-Sent Events (SSE).
* 🔒 **Private Channels**: Built-in support for JWT-authorized private channels.
* ⚛️ **Framework Agnostic**: Works perfectly with raw JavaScript, React, Vue, or Svelte.
* 🧠 **Simple API**: Minimalist subscription and event-handling syntax (`.channel().listen()`).
* ⚡ **Resource Efficient**: Light alternative to WebSockets, powered by native browser capabilities.

## 📦 Installation

```bash
npm install tonka-broadcaster
# or
yarn add tonka-broadcaster

```

## ⚙️ Setup

Ensure your **Tonka** backend is configured to broadcast events via your Mercure Hub (`http://localhost:3000/.well-known/mercure`).

Initialize the broadcaster in your frontend entry point (e.g., `app.js` or `main.js`) :

```javascript
import TonkaBroadcaster from 'tonka-broadcaster';

const broadcaster = new TonkaBroadcaster({
    hubUrl: 'http://localhost:3000/.well-known/mercure',
    // Required only if you intend to use private channels
    token: () => localStorage.getItem('tonka_jwt_token') 
});

export default broadcaster;

```

---

## 🚀 Usage

### 1. Listen to Public Channels

Subscribe to a public channel to listen for global real-time events.

```javascript
import broadcaster from './broadcaster';

// Subscribe to a public channel
const channel = broadcaster.channel('notifications');

// Listen for a specific event
channel.listen('NewNotification', (data) => {
    console.log('Notification received:', data.message);
    alert(`New Alert: ${data.title}`);
});

```

### 2. Listen to Private Channels

For user-specific data or protected data streams, use private channels. The package automatically attaches your JWT token to authorize the stream.

```javascript
import broadcaster from './broadcaster';

// Subscribe to a secure private channel
broadcaster
    .private(`user.${userId}`)
    .listen('OrderUpdated', (order) => {
        console.log(`Order #${order.id} status is now: ${order.status}`);
    });

```

### 3. Unsubscribe & Cleanup

Avoid memory leaks in components (like React's `useEffect` or Vue's `onUnmounted`) by unsubscribing when the view is destroyed.

```javascript
// Leave a single channel
broadcaster.leave('notifications');

// Or leave a private channel
broadcaster.leave(`user.${userId}`);

```

---

> 💡 **Pro-Tip for Tonka Ecosystem:** Combine `tonka-router` and `tonka-broadcaster` to trigger dynamic redirects or fetch fresh data using named routes directly inside your event listeners!