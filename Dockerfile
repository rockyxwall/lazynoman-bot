# Use the official Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files and lockfile
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# The bot doesn't need to expose a port, but Fly.io sometimes expects one for health checks.
# However, for a Discord bot, we can just run the process.
CMD ["bun", "run", "bot/index.ts"]
