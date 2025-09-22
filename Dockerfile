FROM node:18-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production serve
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]