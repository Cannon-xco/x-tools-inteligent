# Production Dockerfile for Railway (Backend/Scraper)
# Includes Playwright dependencies for Google Maps scraping

FROM mcr.microsoft.com/playwright:v1.48.0-focal

# Set working directory
WORKDIR /app

# Install Node.js v20 (Playwright image uses an older version usually)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Copy package files
COPY package.json package-lock.json* ./

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install dependencies
RUN npm install

# Install Playwright browsers to the global path defined above
RUN npx playwright install chromium --with-deps

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Force Next.js to bind to 0.0.0.0 and use port 3000
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
