FROM node:20-alpine

WORKDIR /app
COPY . /app

ENV NODE_ENV=production \
    PORT=80 \
    DATA_DIR=/app/data

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["node", "server/server.js"]
