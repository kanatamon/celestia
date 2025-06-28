FROM node:20-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT
ARG VITE_SENTRY_DEBUG
ARG VITE_SENTRY_ORG
ARG VITE_SENTRY_PROJECT
ARG VITE_SENTRY_AUTH_TOKEN

ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT
ENV VITE_SENTRY_DEBUG=$VITE_SENTRY_DEBUG
ENV VITE_SENTRY_ORG=$VITE_SENTRY_ORG
ENV VITE_SENTRY_PROJECT=$VITE_SENTRY_PROJECT
ENV VITE_SENTRY_AUTH_TOKEN=$VITE_SENTRY_AUTH_TOKEN

COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:20-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
CMD ["npm", "run", "start"]