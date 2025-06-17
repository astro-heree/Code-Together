# Use Node 16 as base image
FROM node:16-alpine

# Set working directory
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code (excluding .env files)
COPY . .

# Set build-time environment variables for React
ARG REACT_APP_BACKEND_URL=http://localhost:8080
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Build the application
RUN npm run build

# Expose port 8080
EXPOSE 8080

# Start the server
CMD ["npm", "run", "server:pod"] 