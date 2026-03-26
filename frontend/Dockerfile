# Frontend Dockerfile (Development)
FROM node:20-alpine

WORKDIR /app

# RUN rm -rf node_modules package-lock.json

# Install dependencies
COPY package.json package-lock.json* ./

# RUN npm install

RUN npm install

# Copy application code
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
