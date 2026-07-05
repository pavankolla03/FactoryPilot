FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY xs-app.json server.js ./
COPY resources ./resources
EXPOSE 5000
CMD ["npm", "run", "start"]
