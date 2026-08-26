# check=skip=SecretsUsedInArgOrEnv

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock ./

RUN --mount=type=cache,id=s/947e19bc-a7e5-41d3-ac6e-ba2941d0a2f6-/root/.yarn,target=/root/.yarn \
    yarn install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn build

# Stage 3: Production server
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.cjs ./server.cjs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock

# Install production dependencies only
RUN --mount=type=cache,id=s/947e19bc-a7e5-41d3-ac6e-ba2941d0a2f6-/root/.yarn,target=/root/.yarn \
    yarn install --frozen-lockfile --production

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.cjs"]
