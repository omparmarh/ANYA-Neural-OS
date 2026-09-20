FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and server dependencies
COPY package*.json ./
COPY freellmapi/server/package*.json ./freellmapi/server/

RUN cd freellmapi/server && npm install

COPY freellmapi/server ./freellmapi/server

RUN cd freellmapi/server && npm run build

FROM node:20-alpine AS runner
WORKDIR /app/freellmapi/server

COPY --from=builder /app/freellmapi/server/dist ./dist
COPY --from=builder /app/freellmapi/server/node_modules ./node_modules
COPY --from=builder /app/freellmapi/server/package.json ./package.json

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]
