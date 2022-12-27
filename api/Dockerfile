FROM node:current-alpine as build

# build module layer
COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm ci
COPY . .

CMD ["node", "api.js"]