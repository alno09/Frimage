# syntax=docker/dockerfile:1
FROM node:22-slim AS deps

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM deps AS builder
COPY . .

RUN npm run build && npm prune --omit=dev

FROM node:22-slim AS runner

ENV NODE_ENV=production

WORKDIR /app

RUN mkdir -p /storage/uploads /storage/outputs && chown -R node:node /app /storage

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 4000

CMD ["node", "dist/index.js"]
