FROM node:14.15.0-alpine as build

# build module layer
COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm ci
COPY . .

EXPOSE 3001
EXPOSE 3002

CMD ["node", "api.js"]