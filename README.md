# UPI Party: paquete mínimo de servidor

Este directorio es la raíz del repositorio que se conectaría a Render. No subir la carpeta completa del proyecto ni C:\. El HTML incluye modelos, texturas y motor. El servidor solo necesita Node 24; no tiene dependencias de npm.

Todavía NO publicado. El usuario eligió servidor alojado; no usar Tailscale ni instalar nada en la PC de su amigo.

## Despliegue propuesto

1. Iniciar sesión en GitHub y Render. Crear un repositorio preferentemente privado para estos archivos y autorizar a Render a leerlo. La creación/publicación todavía está pendiente.
2. En Render: New > Web Service, conectar el repositorio, runtime Node, plan Free.
3. Build command: `node --check online-server.mjs`. Start: `npm start`. Health: `/health`.
4. Variable HOST = `0.0.0.0`; Render proporciona PORT y RENDER_EXTERNAL_URL. Para un dominio propio, agregarlo explícitamente a ALLOWED_ORIGINS.
5. Revisar que no se hayan elegido base de datos, disco, escalado o plan pagos. No añadir medio de pago ni aceptar cargos sin autorización.
6. Abrir la URL HTTPS generada en ambas PCs. Online > Host / Unirse. Entrar al mismo portal para comenzar.

La configuración render.yaml es alternativa para crear el servicio con Blueprint. No dispara despliegues automáticos: evitar reiniciar una partida al subir una actualización.

## Límites importantes

Render Free puede dormirse tras 15 minutos sin tráfico; despertar tarda alrededor de un minuto. Las salas en memoria se pierden al reiniciar o desplegar. Hay cupos de horas, transferencia y builds; con un medio de pago registrado puede haber cobros por excedentes. Revisar el panel antes de desplegar. No se promete disponibilidad permanente ni latencia baja desde Argentina.

Fuentes revisadas: https://render.com/docs/free y https://render.com/docs/environment-variables .

Memoria, Fakeout, Aim y Odd están conectados. Pelotas y Flechas online todavía pendientes. Offline conserva los cinco juegos. No hay ladder ni premios online; los resultados de duelos son de sesión. No se afirma protección competitiva antitrampas.

Para actualizar el paquete desde el proyecto original: `node build.mjs`, luego `node build-hosting.mjs`. Para probarlo localmente: `npm start` en esta carpeta (si HOST no está configurado, escucha solo en 127.0.0.1).
