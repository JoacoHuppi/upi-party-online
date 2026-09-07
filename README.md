# UPI Party · multiplayer online

Servidor autoritativo de salas privadas para partidas de dos jugadores. El tráfico en tiempo real usa un WebSocket persistente; HTTP queda para crear/unirse a una sala, recuperar el estado inicial y `GET /health`.

## Transporte

- `POST /api/create` y `POST /api/join`: crean la sesión y entregan el token.
- `GET /api/state`: estado inicial y comprobación de recuperación.
- `GET /health`: health check sin autenticación.
- `GET /ws` (upgrade WebSocket): autenticación, estados, movimiento y acciones durante la partida.
- `GET /api/events` y `POST /api/action`: compatibilidad temporal con clientes anteriores; el cliente actual no los usa en la red.

El token se envía en el primer mensaje WebSocket y no en la URL. El servidor mide RTT con ping/pong, limita mensajes y tamaño, conserva la validación de salas/poses/fases y no acepta ganadores ni timestamps competitivos del cliente. Los estados retrasados se coalescen y el movimiento usa secuencias “latest only” a 25 Hz.

## Desarrollo local

Requiere Node.js 24 y pnpm.

```sh
pnpm install
pnpm test
pnpm start
```

Abrir `http://127.0.0.1:8787`. Para un smoke test contra una instancia desplegada:

```sh
node scripts/smoke-live.mjs https://upi-party-online.fly.dev
```

`network-client.js` es la fuente legible de la capa cliente. `node scripts/update-client-bundle.mjs` sincroniza esa capa dentro de `UPI-Party-3D.html` y aplica los dos cambios mínimos del bundle. Incrustarlo permite que el mismo HTML funcione en web y en el paquete Tauri sin depender de copiar otro asset.

## Fly.io

La configuración incluida usa una Machine shared de 256 MB en São Paulo (`gru`), puerto interno `8080`, HTTPS obligatorio y auto-stop cuando no hay actividad.

```sh
fly deploy --ha=false --remote-only
fly status
```

URL pública: `https://upi-party-online.fly.dev` (WebSocket: `wss://upi-party-online.fly.dev/ws`). Las salas viven en memoria y se pierden si la Machine se reinicia o se detiene. Para evitar cualquier cold start se puede cambiar `min_machines_running` a `1`, con el costo que corresponda al plan de Fly.

## Render y Tauri

`render.yaml` se conserva como rollback y no se elimina hasta que Fly esté validado en uso real entre dos PCs.

Este repositorio no contiene `src-tauri/` ni `tauri.conf.json`; por eso no se modificó una configuración Tauri inexistente. El HTML ya contiene la capa WebSocket. Si el proyecto fuente de escritorio define CSP, `connect-src` debe permitir como mínimo:

```text
https://upi-party-online.fly.dev wss://upi-party-online.fly.dev
```

No ampliar `connect-src` a `*`. La build de Tauri debe seguir incluyendo `UPI-Party-3D.html`, igual que antes.

## Modos

Aim, Sequence, Odd y Fakeout son duelos online controlados por el servidor. Pelotas y Dance dentro de una sala siguen siendo prácticas locales independientes, como en la versión anterior. No hay ladder autoritativa ni persistencia de salas.
