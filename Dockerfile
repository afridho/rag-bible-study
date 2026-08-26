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

# 🔑 RAILWAY BUILD ARGUMENTS
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

# Stage 3: Serve static files
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN yarn global add serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000
ENV PORT=3000

CMD ["serve", "dist", "-s", "-l", "3000"]
