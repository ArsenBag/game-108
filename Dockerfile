# Для Railway / Fly.io / любого Docker-хостинга
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3108
EXPOSE 3108
CMD ["node", "server.js"]
