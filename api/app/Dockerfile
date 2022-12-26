# build environment
FROM node:14.15.0-alpine as build
WORKDIR /app
ENV PATH ./node_modules/.bin:$PATH
COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm ci
COPY ./ ./
RUN npm run build

# production environment
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
