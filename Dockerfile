# =============================================================================
# Stage 1 — Dependências
# =============================================================================
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copia manifests de pacotes
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Instala todas as dependências (incluindo devDependencies para o build)
RUN npm ci

# Gera o Prisma Client para a arquitetura correta do container
RUN npx prisma generate

# =============================================================================
# Stage 2 — Build
# =============================================================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copia node_modules + prisma client gerado
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis de build necessárias (valores reais são injetados em runtime pelo Coolify)
ARG DATABASE_URL
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG XRS_ENDPOINT_URL
ARG XRS_CALLER_CODE
ARG XRS_PASSWORD
ARG CIELO_MERCHANT_ID
ARG CIELO_MERCHANT_KEY
ARG CIELO_SANDBOX

ENV DATABASE_URL=$DATABASE_URL \
    NEXTAUTH_URL=$NEXTAUTH_URL \
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
    XRS_ENDPOINT_URL=$XRS_ENDPOINT_URL \
    XRS_CALLER_CODE=$XRS_CALLER_CODE \
    XRS_PASSWORD=$XRS_PASSWORD \
    CIELO_MERCHANT_ID=$CIELO_MERCHANT_ID \
    CIELO_MERCHANT_KEY=$CIELO_MERCHANT_KEY \
    CIELO_SANDBOX=$CIELO_SANDBOX \
    NEXT_TELEMETRY_DISABLED=1

# Roda o push do schema para o banco de dados (sincroniza as tabelas)
RUN npx prisma db push --accept-data-loss

# Roda o build do Next.js (gera .next/standalone)
# NODE_OPTIONS limita o heap para evitar OOM no "Collecting build traces" em servidores com pouca RAM
RUN NODE_OPTIONS=--max-old-space-size=1024 npm run build
# =============================================================================
# Stage 3 — Runner (imagem final leve)
# =============================================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Cria usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copia apenas os artefatos necessários do stage de build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema (necessário em runtime para migrações/queries)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Inicia o servidor standalone do Next.js
CMD ["node", "server.js"]
