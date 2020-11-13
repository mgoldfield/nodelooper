FROM node:12

# build module layer
COPY ./package*.json ./
RUN npm ci
COPY . .

EXPOSE 3001
EXPOSE 8080

CMD ["node", "api.js"]