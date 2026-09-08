FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080

COPY package.json pnpm-lock.yaml ./
# pokemon-showdown trae opcionales pesadas y nativas (sqlite3, pg, nodemailer) que el simulador no usa:
# se omiten a proposito. Verificado que el motor arranca sin ellas.
RUN corepack enable && pnpm install --prod --frozen-lockfile --no-optional --ignore-scripts

COPY online-server.mjs room-service.js network-client.js ./
COPY aim-rules.js cosmetics-data.js duel-rules.js odd-rules.js party-rules.js sequence-rules.js shared-duel.js ./
# Minijuego Pokemon: adaptador del motor, armado de equipos, catalogo generado y ranking de victorias.
COPY pokemon-battle-service.mjs pokemon-teams.mjs pokemon-data.js pokemon-ranking.mjs ./
COPY UPI-Party-3D.html ./

USER node
EXPOSE 8080
CMD ["node", "online-server.mjs"]
