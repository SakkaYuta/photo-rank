FROM node:18-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Create non-root user and adjust ownership
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /app

# Build
RUN npm run build

# Production serve
EXPOSE 4173
USER appuser
ENV NODE_ENV=production
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
