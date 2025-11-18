# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Build the Vite React app
COPY . .
RUN npm run build

# ---- Run stage ----
FROM nginx:1.27-alpine

# Copy built files from previous stage into Nginx html folder
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 inside the container
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
