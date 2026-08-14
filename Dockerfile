# =============================================================================
# Stage 1 — Dependências
# =============================================================================
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copia manifests de pacotes
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Instala todas as dependências (incluindo devDependências para o build)
# NOTA: 'npm ci' já executa 'prisma generate' via postinstall — sem duplicação.
RUN npm ci

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
# NODE_OPTIONS limita o heap para evitar OOM no "Collecting build traces" em servidores com pouca RAM.
# Reduzido de 2048 para 1536: um teto mais baixo faz o V8 coletar lixo com mais
# frequência ANTES de esbarrar na memória real do container — 2048 estava permitindo
# o heap crescer além do que a máquina tinha disponível, e o kernel matava o
# processo por OOM antes do V8 sequer perceber que estava perto do limite.
RUN NODE_OPTIONS=--max-old-space-size=1536 npm run build
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

# Copia prisma CLI necessário para rodar migrate deploy no startup
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Muda para root para dar permissão de execução, depois volta para nextjs
USER root
RUN chown -R nextjs:nodejs /app/node_modules/.bin /app/node_modules/prisma 2>/dev/null || true
USER nextjs


EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Roda migrate deploy ao iniciar (|| true = não falha se já aplicado ou se houver erro)
# Usa caminho direto ao binário — evita tentativa de download do npx
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy 2>&1 || true && node server.js"]

