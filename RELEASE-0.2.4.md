# UPI Party 0.2.4 — multiplayer WebSocket en Fly.io

- Migración del tráfico en tiempo real de POST + SSE a una conexión WebSocket persistente.
- Servidor principal trasladado a Fly.io en São Paulo (`gru`) para reducir latencia en Argentina.
- Movimiento online a aproximadamente 25 actualizaciones por segundo, sin esperar confirmación entre posiciones y descartando snapshots viejos.
- Reconexión automática, ping/RTT y aislamiento estricto de salas de dos jugadores.
- Fakeout y minijuegos de reacción conservan autoridad del servidor; los casos muy cerrados se detectan con RTT sin confiar en timestamps del cliente.
- HTTP se conserva para crear/unirse a salas, estado inicial, recuperación y health checks.
