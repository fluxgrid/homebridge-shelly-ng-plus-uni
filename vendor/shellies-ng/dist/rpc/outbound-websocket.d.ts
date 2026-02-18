/// <reference types="node" />
import EventEmitter from 'eventemitter3';
import { JSONRPCClient } from 'json-rpc-2.0';
import { WebSocket, WebSocketServer } from 'ws';
import { DeviceDiscoverer, DeviceIdentifiers } from '../discovery';
import { DeviceId } from '../devices';
import { RpcHandler, RpcParams } from './base';
export interface OutboundWebSocketOptions {
    /**
     * The hostname to bind the server to.
     */
    host?: string;
    /**
     * The port number to listen for incoming connections on.
     */
    port: number;
    /**
     * Accept only incoming connections to this path.
     */
    path?: string;
    /**
     * A unique ID used to identify this client when communicating with the Shelly device.
     */
    clientId: string;
    /**
     * The time, in seconds, to wait for a response before a request is aborted.
     */
    requestTimeout: number;
}
declare type OutboundWebSocketServerEvents = {
    /**
     * The 'listening' event is emitted when the server has started listening for incoming connections.
     */
    listening: () => void;
    /**
     * The 'close' event is emitted when the server has been disconnected.
     */
    close: () => void;
    /**
     * The 'connection' event is emitted  for each new incoming connection.
     */
    connection: (socket: WebSocket) => void;
    /**
     * The 'discover' event is emitted when a new device has connected to the server.
     */
    discover: (identifiers: DeviceIdentifiers) => void;
    /**
     * The 'error' event is emitted if an error occurs.
     */
    error: (error: Error) => void;
};
/**
 * Manages a websocket server that accepts incoming connections from Shelly devices (called Outbound WebSocket).
 */
export declare class OutboundWebSocketServer extends EventEmitter<OutboundWebSocketServerEvents> implements DeviceDiscoverer {
    /**
     * The underlying server instance.
     */
    protected readonly server: WebSocketServer;
    /**
     * Holds all RPC handlers.
     */
    protected readonly rpcHandlers: Map<DeviceId, OutboundWebSocketRpcHandler>;
    /**
     * Configuration options for this server.
     */
    readonly options: OutboundWebSocketOptions;
    /**
     * Event handlers bound to `this`.
     */
    protected readonly listeningHandler: () => void;
    protected readonly closeHandler: () => void;
    protected readonly connectionHandler: (socket: WebSocket) => void;
    protected readonly errorHandler: (error: Error) => void;
    /**
     * @param options - Configuration options for this server.
     */
    constructor(options?: Partial<OutboundWebSocketOptions>);
    /**
     * Returns an RPC handler for the given device ID.
     * If a handler for the device ID does not already exist, one will be created.
     * @param deviceId - The device ID.
     */
    getRpcHandler(deviceId: DeviceId): OutboundWebSocketRpcHandler;
    /**
     * Stops the server from accepting new connections.
     */
    close(): Promise<void>;
    /**
     * Handles 'listening' events from the server.
     */
    protected handleListening(): void;
    /**
     * Handles 'close' events from the server.
     */
    protected handleClose(): void;
    /**
     * Handles new connections.
     * @param socket - The newly opened websocket.
     */
    protected handleConnection(socket: WebSocket): void;
    /**
     * Handles errors from the server.
     * @param error - The error that occurred.
     */
    protected handleError(error: Error): void;
}
/**
 * Makes remote procedure calls (RPCs) over Outbound WebSockets.
 */
export declare class OutboundWebSocketRpcHandler extends RpcHandler {
    protected readonly options: OutboundWebSocketOptions;
    /**
     * Handles parsing of JSON RPC requests and responses.
     */
    protected readonly client: JSONRPCClient;
    /**
     * Event handlers bound to `this`.
     */
    protected readonly openHandler: () => void;
    protected readonly closeHandler: (code: number, reason: Buffer) => void;
    protected readonly messageHandler: (data: Buffer) => void;
    protected readonly errorHandler: (error: Error) => void;
    /**
     * @param socket - The websocket to communicate over.
     * @param options - Configuration options for this handler.
     */
    constructor(socket: WebSocket | null, options: OutboundWebSocketOptions);
    private _socket;
    /**
     * The underlying websocket.
     */
    get socket(): WebSocket | null;
    set socket(socket: WebSocket | null);
    get connected(): boolean;
    request<T>(method: string, params?: RpcParams): PromiseLike<T>;
    destroy(): PromiseLike<void>;
    /**
     * Sets up event listeners on the current socket.
     */
    protected setupSocket(): void;
    /**
     * Disconnects the socket and unregisters event handlers.
     */
    protected disconnect(): Promise<void>;
    /**
     * Returns a Promise that will be fulfilled once the socket is disconnected.
     */
    protected awaitDisconnect(): Promise<void>;
    /**
     * Handles a request.
     * @param payload - The request payload.
     */
    protected handleRequest(payload: RpcParams): Promise<void>;
    /**
     * Sends a request over the websocket.
     * @param payload - The request payload.
     */
    protected sendRequest(payload: RpcParams): Promise<void>;
    /**
     * Handles 'open' events from the socket.
     */
    protected handleOpen(): void;
    /**
     * Handles 'close' events from the socket.
     * @param code - A status code.
     * @param reason - A human-readable explanation why the connection was closed.
     */
    protected handleClose(code: number, reason: Buffer): void;
    /**
     * Handles incoming messages.
     * @param data The message data, as a JSON encoded string.
     */
    protected handleMessage(data: Buffer): void;
    /**
     * Handles errors from the websocket.
     * @param error - The error.
     */
    protected handleError(error: Error): void;
}
export {};
//# sourceMappingURL=outbound-websocket.d.ts.map