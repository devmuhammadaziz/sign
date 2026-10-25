FROM oven/bun:1.3-alpine

WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY src ./src
COPY tsconfig.json ./

ENV GATEWAY_PORT=3001
EXPOSE 3001
CMD ["bun", "run", "src/index.ts"]
