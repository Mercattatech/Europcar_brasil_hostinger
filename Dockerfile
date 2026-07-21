# =============================================================================
# Stage 1 — Dependências
# =============================================================================
FROM node:22-alpine AS deps

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
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copia node_modules + prisma client gerado
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis de build necessárias (valores reais são injetados em runtime pelo Coolify)
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET

ENV NEXTAUTH_URL=$NEXTAUTH_URL \
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
    NEXT_TELEMETRY_DISABLED=1

# DATABASE_URL fictício para o build — Prisma precisa da variável para compilar,
# mas NÃO acessa o banco durante o build. A URL real é injetada em runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# NÃO rodar prisma db push aqui! Migrações devem ser feitas manualmente ou
# via job separado no Coolify. Rodar no build é perigoso (--accept-data-loss)
# e requer acesso ao banco durante o build.

# Roda o build do Next.js (gera .next/standalone)
# NODE_OPTIONS limita o heap para evitar OOM no "Collecting build traces" em servidores com pouca RAM
RUN NODE_OPTIONS=--max-old-space-size=1024 npm run build
# =============================================================================
# Stage 3 — Runner (imagem final leve)
# =============================================================================
FROM node:22-alpine AS runner

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
