FROM node:20-alpine

WORKDIR /app

# First copy only package files
COPY package*.json ./

# Install dependencies (no dev deps)
RUN npm install --omit=dev

# Now copy the rest of the app
COPY . .

ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
