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

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the Next.js application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
# We use npm start which runs 'next start'
CMD ["npm", "start"]
