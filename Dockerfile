FROM node:26.13.0-alpine AS base

RUN npm install -g corepack && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack install

FROM base AS build

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM base AS production

ENV NODE_ENV=production

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --package-import-method=copy

COPY --from=build /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main"]
