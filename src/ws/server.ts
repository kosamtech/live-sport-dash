import { WebSocket, WebSocketServer, RawData } from 'ws';
import type { Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { wsArcjet } from "../arcjet.js";

/**
 * Extend WebSocket with custom properties used for
 * heartbeat tracking and per-socket match subscriptions.
 */
interface LiveSocket extends WebSocket {
    isAlive: boolean;
    subscriptions: Set<number>;
}

/** Shape of a row returned from the `matches` table. */
type MatchPayload = Record<string, unknown>;

/** Shape of a row returned from the `commentary` table. */
type CommentaryPayload = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/*  Per-match subscriber tracking                                      */
/* ------------------------------------------------------------------ */

const matchSubscribers = new Map<number, Set<LiveSocket>>();

function subscribe(matchId: number, socket: LiveSocket): void {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId)!.add(socket);
}

function unsubscribe(matchId: number, socket: LiveSocket): void {
    const subscribers = matchSubscribers.get(matchId);

    if (!subscribers) return;

    subscribers.delete(socket);

    if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscriptions(socket: LiveSocket): void {
    for (const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sendJson(socket: WebSocket, payload: Record<string, unknown>): void {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss: WebSocketServer, payload: Record<string, unknown>): void {
    const message = JSON.stringify(payload);

    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;

        client.send(message);
    }
}

function broadcastToMatch(matchId: number, payload: Record<string, unknown>): void {
    const subscribers = matchSubscribers.get(matchId);
    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for (const client of subscribers) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Message handler                                                    */
/* ------------------------------------------------------------------ */

function handleMessage(socket: LiveSocket, data: RawData): void {
    let message: { type?: string; matchId?: number } | undefined;

    try {
        message = JSON.parse(data.toString()) as { type?: string; matchId?: number };
    } catch {
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
        return;
    }

    if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
        subscribe(message.matchId!, socket);
        socket.subscriptions.add(message.matchId!);
        sendJson(socket, { type: 'subscribed', matchId: message.matchId! });
        return;
    }

    if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId!, socket);
        socket.subscriptions.delete(message.matchId!);
        sendJson(socket, { type: 'unsubscribed', matchId: message.matchId! });
    }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function attachWebSocketServer(server: Server) {
    const wss = new WebSocketServer({ noServer: true, path: '/ws', maxPayload: 1024 * 1024 });

    server.on('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`);

        if (pathname !== '/ws') {
            return;
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    if (decision.reason.isRateLimit()) {
                        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
                    } else {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    }
                    socket.destroy();
                    return;
                }
            } catch (e) {
                console.error('WS upgrade protection error', e);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
        const socket = ws as LiveSocket;

        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });

        socket.subscriptions = new Set<number>();

        sendJson(socket, { type: 'welcome' });

        socket.on('message', (data: RawData) => {
            handleMessage(socket, data);
        });

        socket.on('error', () => {
            socket.terminate();
        });

        socket.on('close', () => {
            cleanupSubscriptions(socket);
        });

        socket.on('error', console.error);
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            const client = ws as LiveSocket;

            if (client.isAlive === false) return client.terminate();

            client.isAlive = false;
            client.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(interval));

    function broadcastMatchCreated(match: MatchPayload): void {
        broadcastToAll(wss, { type: 'match_created', data: match });
    }

    function broadcastCommentary(matchId: number, comment: CommentaryPayload): void {
        broadcastToMatch(matchId, { type: 'commentary', data: comment });
    }

    return { broadcastMatchCreated, broadcastCommentary };
}
