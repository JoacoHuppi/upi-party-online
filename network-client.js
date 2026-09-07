(() => {
  'use strict';

  const SERVER_URL = String(globalThis.UPI_PARTY_SERVER_URL || 'https://upi-party-online.fly.dev').replace(/\/$/, '');
  const HTTP_API_URL = SERVER_URL;
  const WEBSOCKET_URL = SERVER_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws';
  const originalFetch = globalThis.fetch.bind(globalThis);
  const encoder = new TextEncoder();
  const transports = new Map();

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {'Content-Type': 'application/json; charset=utf-8'}
    });
  }

  function requestInfo(input, init) {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, location.href);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    return {url, headers, method: String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()};
  }

  class RoomTransport {
    constructor(origin, token) {
      this.origin = origin;
      this.token = token;
      this.socket = null;
      this.pending = new Map();
      this.moveTimer = null;
      this.latestMove = null;
      this.lastMoveAt = 0;
      this.moveSeq = 0;
      this.moveEpoch = crypto.randomUUID();
      this.generation = 0;
      this.rtt = null;
    }

    socketUrl() {
      return this.origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws';
    }

    close(reason = 'replaced') {
      this.generation++;
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
      this.latestMove = null;
      for (const {reject, timer} of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error('Conexión interrumpida.'));
      }
      this.pending.clear();
      const socket = this.socket;
      this.socket = null;
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, reason);
    }

    openAsEventStream(signal) {
      this.close('reconnect');
      const generation = this.generation;
      let controller;
      let settled = false;
      let resolveResponse;
      let rejectResponse;
      const responseReady = new Promise((resolve, reject) => {
        resolveResponse = resolve;
        rejectResponse = reject;
      });
      const stream = new ReadableStream({
        start(value) { controller = value; },
        cancel: () => this.close('reader-cancelled')
      });
      const response = new Response(stream, {
        status: 200,
        headers: {'Content-Type': 'text/event-stream; charset=utf-8'}
      });
      const socket = new WebSocket(this.socketUrl());
      this.socket = socket;

      const fail = error => {
        if (generation !== this.generation) return;
        if (!settled) {
          settled = true;
          rejectResponse(error);
        } else {
          try { controller.error(error); } catch {}
        }
      };

      socket.addEventListener('open', () => {
        if (generation !== this.generation) return socket.close(1000, 'stale');
        socket.send(JSON.stringify({type: 'auth', token: this.token}));
      });
      socket.addEventListener('message', event => {
        if (generation !== this.generation || typeof event.data !== 'string' || event.data.length > 100000) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return fail(new Error('Respuesta WebSocket inválida.')); }
        if (message.type === 'ping') {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type: 'pong', id: message.id}));
          return;
        }
        if (message.type === 'latency' && Number.isFinite(message.rtt)) {
          this.rtt = Math.max(0, Math.round(message.rtt));
          globalThis.UPI_NETWORK_RTT = this.rtt;
          globalThis.dispatchEvent(new CustomEvent('upi:network-rtt', {detail: {rtt: this.rtt}}));
          return;
        }
        if (message.type === 'ack' && typeof message.requestId === 'string') {
          const pending = this.pending.get(message.requestId);
          if (!pending) return;
          this.pending.delete(message.requestId);
          clearTimeout(pending.timer);
          pending.resolve(message.result || {accepted: true});
          return;
        }
        if (message.type === 'error') {
          const error = Object.assign(new Error(message.error || 'Error WebSocket.'), {status: message.status || 400});
          const pending = this.pending.get(message.requestId);
          if (pending) {
            this.pending.delete(message.requestId);
            clearTimeout(pending.timer);
            pending.reject(error);
          } else fail(error);
          return;
        }
        if (message.type !== 'state' || !message.state) return;
        if (!settled) {
          settled = true;
          resolveResponse(response);
        }
        controller.enqueue(encoder.encode('data: ' + JSON.stringify(message.state) + '\n\n'));
      });
      socket.addEventListener('error', () => fail(new Error('No se pudo abrir el WebSocket.')));
      socket.addEventListener('close', event => {
        if (generation !== this.generation || signal?.aborted) return;
        fail(Object.assign(new Error(event.reason || 'Conexión WebSocket interrumpida.'), {status: event.code === 4401 ? 401 : 0}));
      });
      signal?.addEventListener('abort', () => this.close('aborted'), {once: true});
      return responseReady;
    }

    sendRaw(action, requestId) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('Esperá a que se restablezca la conexión.');
      this.socket.send(JSON.stringify({type: 'action', requestId, action}));
    }

    sendMove(action) {
      this.latestMove = {...action, seq: ++this.moveSeq, epoch: this.moveEpoch};
      const flush = () => {
        this.moveTimer = null;
        if (!this.latestMove || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        if (this.socket.bufferedAmount > 32768) {
          this.moveTimer = setTimeout(flush, 20);
          return;
        }
        const latest = this.latestMove;
        this.latestMove = null;
        this.lastMoveAt = performance.now();
        this.sendRaw(latest);
      };
      const wait = Math.max(0, 40 - (performance.now() - this.lastMoveAt));
      if (!this.moveTimer) this.moveTimer = setTimeout(flush, wait);
      return {accepted: true, queued: true};
    }

    sendAction(action) {
      if (action.type === 'move') return Promise.resolve(this.sendMove(action));
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          reject(new Error('El servidor no confirmó la acción a tiempo.'));
        }, 8000);
        this.pending.set(requestId, {resolve, reject, timer});
        try { this.sendRaw(action, requestId); }
        catch (error) {
          clearTimeout(timer);
          this.pending.delete(requestId);
          reject(error);
        }
      });
    }
  }

  function transportFor(origin, token) {
    const key = origin + '|' + token;
    let transport = transports.get(key);
    if (!transport) {
      transport = new RoomTransport(origin, token);
      transports.set(key, transport);
    }
    return transport;
  }

  globalThis.fetch = async (input, init) => {
    const {url, headers, method} = requestInfo(input, init);
    const token = (headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (url.pathname === '/api/events' && method === 'GET' && token) {
      return transportFor(url.origin, token).openAsEventStream(init?.signal);
    }
    if (url.pathname === '/api/action' && method === 'POST' && token) {
      let action;
      try { action = JSON.parse(String(init?.body || '{}')); }
      catch { return jsonResponse({error: 'JSON inválido.'}, 400); }
      try { return jsonResponse(await transportFor(url.origin, token).sendAction(action)); }
      catch (error) { return jsonResponse({error: error.message}, error.status || 503); }
    }
    return originalFetch(input, init);
  };

  Object.defineProperty(globalThis, 'UPI_PARTY_NETWORK', {
    value: Object.freeze({SERVER_URL, HTTP_API_URL, WEBSOCKET_URL}),
    configurable: false,
    writable: false
  });

  const setDefaultServer = () => {
    const input = document.getElementById('onlineURL');
    if (input && (!input.value || input.value === 'https://upi-party-online.onrender.com')) input.value = SERVER_URL;
  };
  new MutationObserver(setDefaultServer).observe(document.documentElement, {childList: true, subtree: true});
  setDefaultServer();
})();
