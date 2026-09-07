FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY online-server.mjs room-service.js network-client.js ./
COPY aim-rules.js cosmetics-data.js duel-rules.js odd-rules.js party-rules.js sequence-rules.js shared-duel.js ./
COPY UPI-Party-3D.html ./

USER node
EXPOSE 8080
CMD ["node", "online-server.mjs"]
