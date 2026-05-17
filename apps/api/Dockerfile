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

RUN apt-get update && apt-get install -y --no-install-recommends \
    imagemagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i 's/domain="coder" rights="none" pattern="PDF"/domain="coder" rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml \
    && sed -i 's/domain="coder" rights="none" pattern="PS"/domain="coder" rights="read|write" pattern="PS"/' /etc/ImageMagick-6/policy.xml \
    && sed -i 's/domain="coder" rights="none" pattern="PS2"/domain="coder" rights="read|write" pattern="PS2"/' /etc/ImageMagick-6/policy.xml \
    && sed -i 's/domain="coder" rights="none" pattern="PS3"/domain="coder" rights="read|write" pattern="PS3"/' /etc/ImageMagick-6/policy.xml \
    && sed -i 's/domain="coder" rights="none" pattern="EPS"/domain="coder" rights="read|write" pattern="EPS"/' /etc/ImageMagick-6/policy.xml \
    && sed -i 's/domain="coder" rights="none" pattern="AI"/domain="coder" rights="read|write" pattern="AI"/' /etc/ImageMagick-6/policy.xml

RUN mkdir -p /storage/uploads /storage/conversions && chown -R node:node /app /storage

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 4000

CMD ["node", "dist/index.js"]
