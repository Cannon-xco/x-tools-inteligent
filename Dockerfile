# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Runner
FROM mcr.microsoft.com/playwright:v1.48.0-focal AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Node.js v20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

# Copy standalone build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# IMPORTANT: Standalone mode doesn't include the 'playwright' binaries in the final image 
# because it only includes what's needed for the node server.
# We must ensure the browsers are present in the focal image's standard path.
RUN npx playwright install chromium --with-deps

EXPOSE 3000

CMD ["node", "server.js"]
