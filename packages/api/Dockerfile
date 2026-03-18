FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

FROM base AS build-web
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY packages/web/ packages/web/
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
RUN pnpm --filter @lyrebird/web build

FROM base AS build-api
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY packages/api/ packages/api/
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
RUN pnpm --filter @lyrebird/api build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=build-api /app/packages/api/dist ./packages/api/dist
COPY --from=build-web /app/packages/web/dist ./public
COPY packages/api/package.json packages/api/
COPY package.json pnpm-workspace.yaml ./

ENV NODE_ENV=production
ENV DB_PATH=/data/clinic.db
EXPOSE 3000
CMD ["node", "packages/api/dist/server.js"]
