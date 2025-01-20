FROM node:18.20.5
WORKDIR /service
RUN apt-get update && apt-get install -y ffmpeg
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]