# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Copy lockfile + manifest first for layer caching.
COPY package.json package-lock.json ./
COPY vendor/ ./vendor/

RUN npm ci

# Copy the rest of the source and build.
COPY . .
RUN npm run build

# ── Serve stage ──────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

# SPA fallback config: unknown routes return index.html so client-side
# routing works under nginx.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
