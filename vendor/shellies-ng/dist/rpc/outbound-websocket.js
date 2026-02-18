"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboundWebSocketRpcHandler = exports.OutboundWebSocketServer = void 0;
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const json_rpc_2_0_1 = require("json-rpc-2.0");
const ws_1 = require("ws");
const base_1 = require("./base");
/**
 * Default server options.
 */
const DEFAULT_SERVER_OPTIONS = {
    port: 8765,
    clientId: 'node-shellies-ng-' + Math.round(Math.random() * 1000000),
    requestTimeout: 10,
};
/**
 * Manages a websocket server that accepts incoming connections from Shelly devices (called Outbound WebSocket).
 */
class OutboundWebSocketServer extends eventemitter3_1.default {
    /**
     * @param options - Configuration options for this server.
     */
    constructor(options) {
        super();
        /**
         * Holds all RPC handlers.
         */
        this.rpcHandlers = new Map();
        /**
         * Event handlers bound to `this`.
         */
        this.listeningHandler = this.handleListening.bind(this);
        this.closeHandler = this.handleClose.bind(this);
        this.connectionHandler = this.handleConnection.bind(this);
        this.errorHandler = this.handleError.bind(this);
        // get all options (with default values)
        const opts = this.options = { ...DEFAULT_SERVER_OPTIONS, ...(options || {}) };
        // create the server
        this.server = new ws_1.WebSocketServer({
            host: opts.host,
            port: opts.port,
            path: opts.path,
        });
        this.server
            .on('listening', this.listeningHandler)
            .on('close', this.closeHandler)
            .on('connection', this.connectionHandler)
            .on('error', this.errorHandler);
    }
    /**
     * Returns an RPC handler for the given device ID.
     * If a handler for the device ID does not already exist, one will be created.
     * @param deviceId - The device ID.
     */
    getRpcHandler(deviceId) {
        // try to find a matching RPC handler
        let rpcHandler = this.rpcHandlers.get(deviceId);
        if (rpcHandler === undefined) {
            // if no RPC handler was found, create one without a websocket
            rpcHandler = new OutboundWebSocketRpcHandler(null, this.options);
            // store it
            this.rpcHandlers.set(deviceId, rpcHandler);
        }
        return rpcHandler;
    }
    /**
     * Stops the server from accepting new connections.
     */
    close() {
        return new Promise((resolve, reject) => {
            this.server.close((error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Handles 'listening' events from the server.
     */
    handleListening() {
        this.emit('listening');
    }
    /**
     * Handles 'close' events from the server.
     */
    handleClose() {
        this.emit('close');
    }
    /**
     * Handles new connections.
     * @param socket - The newly opened websocket.
     */
    handleConnection(socket) {
        this.emit('connection', socket);
        // create a 'message' handler
        const messageHandler = (data) => {
            try {
                // parse the data
                const d = JSON.parse(data.toString());
                // make sure a source (device ID) is specified
                if (typeof d.src === 'string') {
                    const deviceId = d.src;
                    const rpcHandler = this.rpcHandlers.get(deviceId);
                    if (rpcHandler) {
                        // if we already have a handler for this device, replace the socket
                        rpcHandler.socket = socket;
                        // re-emit the message so that the RPC handler sees it
                        socket.emit('message', data);
                    }
                    else {
                        // if this is a new device, create a handler for it and emit a 'discover' event
                        this.rpcHandlers.set(deviceId, new OutboundWebSocketRpcHandler(socket, this.options));
                        this.emit('discover', {
                            deviceId,
                            protocol: 'outboundWebsocket',
                        });
                    }
                }
                else {
                    throw new Error('Message source missing or invalid: ' + d.src);
                }
            }
            catch (e) {
                this.emit('error', e instanceof Error ? e : new Error(String(e)));
            }
            // stop listening for events from this socket, the RPC handler takes over from here
            removeListeners();
        };
        // create a 'close' handler
        const closeHandler = (code) => {
            // the socket was unexpectedly closed before a message was received
            this.emit('error', new Error(`Incoming connection closed unexpectedly (code: ${code})`));
            removeListeners();
        };
        // create an 'error' handler
        const errorHandler = (error) => {
            this.emit('error', new Error('Error in incoming connection: ' + error.message));
            removeListeners();
        };
        const removeListeners = () => {
            socket
                .off('message', messageHandler)
                .off('close', closeHandler)
                .off('error', errorHandler);
        };
        // add our event handlers
        socket
            .once('message', messageHandler)
            .once('close', closeHandler)
            .once('error', errorHandler);
    }
    /**
     * Handles errors from the server.
     * @param error - The error that occurred.
     */
    handleError(error) {
        this.emit('error', error);
    }
}
exports.OutboundWebSocketServer = OutboundWebSocketServer;
/**
 * Makes remote procedure calls (RPCs) over Outbound WebSockets.
 */
class OutboundWebSocketRpcHandler extends base_1.RpcHandler {
    /**
     * @param socket - The websocket to communicate over.
     * @param options - Configuration options for this handler.
     */
    constructor(socket, options) {
        super('outboundWebsocket');
        this.options = options;
        /**
         * Event handlers bound to `this`.
         */
        this.openHandler = this.handleOpen.bind(this);
        this.closeHandler = this.handleClose.bind(this);
        this.messageHandler = this.handleMessage.bind(this);
        this.errorHandler = this.handleError.bind(this);
        this._socket = socket;
        this.setupSocket();
        this.client = new json_rpc_2_0_1.JSONRPCClient((req) => this.handleRequest(req));
    }
    /**
     * The underlying websocket.
     */
    get socket() {
        return this._socket;
    }
    set socket(socket) {
        if (socket === this._socket) {
            // abort if this is our own socket
            return;
        }
        const oldSocket = this._socket;
        this._socket = socket;
        this.setupSocket();
        // if the old and the new sockets are not in the same state we may have to emit an event
        if (socket === null || oldSocket === null || socket.readyState !== oldSocket.readyState) {
            if (socket !== null && socket.readyState === ws_1.WebSocket.OPEN) {
                this.emit('connect');
            }
            else if (oldSocket !== null && oldSocket.readyState === ws_1.WebSocket.OPEN) {
                this.emit('disconnect', 1000, 'Socket replaced', null);
            }
        }
    }
    get connected() {
        return this._socket !== null && this._socket.readyState === ws_1.WebSocket.OPEN;
    }
    request(method, params) {
        this.emit('request', method, params);
        return this.client
            .timeout(this.options.requestTimeout * 1000)
            .request(method, params);
    }
    destroy() {
        // reject all pending requests
        this.client.rejectAllPendingRequests('Connection closed');
        // disconnect the socket
        return this.disconnect();
    }
    /**
     * Sets up event listeners on the current socket.
     */
    setupSocket() {
        if (this._socket === null) {
            // abort if we don't have a socket
            return;
        }
        this._socket
            .on('open', this.openHandler)
            .on('close', this.closeHandler)
            .on('message', this.messageHandler)
            .on('error', this.errorHandler);
    }
    /**
     * Disconnects the socket and unregisters event handlers.
     */
    async disconnect() {
        if (this._socket === null) {
            // return immediately if we don't have a socket
            return;
        }
        switch (this._socket.readyState) {
            case ws_1.WebSocket.OPEN:
            case ws_1.WebSocket.CONNECTING:
                // close the socket
                this._socket.close(1000, 'User request');
            // fall through
            case ws_1.WebSocket.CLOSING:
                // wait for the socket to be closed
                await this.awaitDisconnect();
        }
    }
    /**
     * Returns a Promise that will be fulfilled once the socket is disconnected.
     */
    awaitDisconnect() {
        const s = this._socket;
        if (s === null) {
            return Promise.resolve();
        }
        if (s.readyState === ws_1.WebSocket.CLOSED) {
            // we're already disconnected
            return Promise.resolve();
        }
        else if (s.readyState !== ws_1.WebSocket.CLOSING) {
            // reject if the socket isn't closing
            return Promise.reject(new Error('WebSocket is not disconnecting'));
        }
        return new Promise((resolve) => {
            // resolve once the socket is disconnected
            s.once('close', resolve);
        });
    }
    /**
     * Handles a request.
     * @param payload - The request payload.
     */
    async handleRequest(payload) {
        // make sure we're connected
        if (!this.connected) {
            throw new Error('WebSocket disconnected');
        }
        // then send the request
        await this.sendRequest(payload);
    }
    /**
     * Sends a request over the websocket.
     * @param payload - The request payload.
     */
    sendRequest(payload) {
        try {
            // make sure we have a socket
            if (this._socket === null) {
                throw new Error('WebSocket disconnected');
            }
            // add our client ID to the payload
            const data = { src: this.options.clientId, ...payload };
            return new Promise((resolve, reject) => {
                // send the request
                this._socket.send(JSON.stringify(data), (error) => {
                    if (!error) {
                        resolve();
                    }
                    else {
                        reject(error);
                    }
                });
            });
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    /**
     * Handles 'open' events from the socket.
     */
    handleOpen() {
        this.emit('connect');
    }
    /**
     * Handles 'close' events from the socket.
     * @param code - A status code.
     * @param reason - A human-readable explanation why the connection was closed.
     */
    handleClose(code, reason) {
        if (this._socket !== null) {
            // remove event handlers
            this._socket
                .off('open', this.openHandler)
                .off('close', this.closeHandler)
                .off('message', this.messageHandler)
                .off('error', this.errorHandler);
        }
        this.emit('disconnect', code, reason.toString(), null);
    }
    /**
     * Handles incoming messages.
     * @param data The message data, as a JSON encoded string.
     */
    handleMessage(data) {
        // parse the data
        const d = JSON.parse(data.toString());
        if (d.id) {
            // this is a response, let the JSON RPC client handle it
            this.client.receive(d);
        }
        else if (d.method === 'NotifyStatus' || d.method === 'NotifyFullStatus') {
            // this is a status update
            this.emit('statusUpdate', d.params);
        }
        else if (d.method === 'NotifyEvent') {
            // this is an event
            this.emit('event', d.params);
        }
    }
    /**
     * Handles errors from the websocket.
     * @param error - The error.
     */
    handleError(error) {
        this.emit('error', error);
    }
}
exports.OutboundWebSocketRpcHandler = OutboundWebSocketRpcHandler;
//# sourceMappingURL=outbound-websocket.js.map