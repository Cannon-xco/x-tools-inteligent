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
# We use the playwright image as base to get all system dependencies for scraping
FROM mcr.microsoft.com/playwright:v1.48.0-focal AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Node.js v20 in the playwright image (which might have an older version)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

# Copy essential standalone files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Install Playwright browsers globally
RUN npx playwright install chromium --with-deps

# Expose port
EXPOSE 3000

# Set dynamic port
ENV PORT 3000

# Run the standalone server
CMD ["node", "server.js"]
