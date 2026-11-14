# Build
FROM node:26.13.0-alpine3.24 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production-ready
FROM node:26.13.0-alpine3.24 AS runner

ENV NODE_ENV=production

USER node
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]
