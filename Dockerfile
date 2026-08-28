FROM node:20-alpine AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/mcp-core/package.json packages/mcp-core/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY services/mcp-auth-workspace/package.json services/mcp-auth-workspace/package.json
COPY services/mcp-messaging/package.json services/mcp-messaging/package.json
COPY services/mcp-media-rtc/package.json services/mcp-media-rtc/package.json
COPY services/mcp-storage/package.json services/mcp-storage/package.json
COPY services/mcp-ai-agent/package.json services/mcp-ai-agent/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm gen:keys && \
    mkdir -p services/mcp-messaging/keys services/mcp-media-rtc/keys services/mcp-storage/keys && \
    cp services/mcp-auth-workspace/keys/access-public.pem services/mcp-messaging/keys/access-public.pem && \
    cp services/mcp-auth-workspace/keys/access-public.pem services/mcp-media-rtc/keys/access-public.pem && \
    cp services/mcp-auth-workspace/keys/access-public.pem services/mcp-storage/keys/access-public.pem && \
    pnpm --filter @openteams/mcp-auth-workspace exec prisma generate --schema prisma/schema.prisma && \
    pnpm --filter @openteams/mcp-messaging exec prisma generate --schema prisma/schema.prisma && \
    pnpm --filter @openteams/mcp-storage exec prisma generate --schema prisma/schema.prisma && \
    pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
ENV NODE_ENV=production
ARG APP
ENV APP=${APP}
COPY --from=build /app ./
RUN rm -rf node_modules/.pnpm/*/node_modules/*/node_modules 2>/dev/null || true
EXPOSE 3000 4001 4002 4003 4004 4005
CMD ["sh", "-c", "case \"$APP\" in auth) exec pnpm --filter @openteams/mcp-auth-workspace start ;; messaging) exec pnpm --filter @openteams/mcp-messaging start ;; rtc) exec pnpm --filter @openteams/mcp-media-rtc start ;; storage) exec pnpm --filter @openteams/mcp-storage start ;; ai) exec pnpm --filter @openteams/mcp-ai-agent start ;; web) exec pnpm --filter @openteams/web start ;; *) echo \"Unknown APP=$APP\" >&2; exit 2 ;; esac"]
