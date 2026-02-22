FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src/ ./src/
COPY scripts/ ./scripts/

RUN npm run build

EXPOSE 3002

CMD ["node", "build/server.js"]
