# Standalone image for the OAR PDR Usage Metrics dashboard: builds the Angular app and serves the
# static bundle behind nginx. Self-contained (no pre-build step), so it works with a plain
# `docker build`. For the OAR-docker integration path (localdeploy + configserver) see
# docs/12-oar-docker-integration.md.

# ---- build stage: Angular 20 requires Node 20 ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The URL sub-path the app is served under (e.g. /metrics/). Root-relative /rmm API calls are
# unaffected by this; only the app's own asset/route paths use it.
ARG BASE_HREF=/
RUN npx ng build --configuration production --base-href "${BASE_HREF}"

# ---- serve stage: static files behind nginx ----
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/data-practice/browser /usr/share/nginx/html
# Regenerate assets/config.json from environment at container start, so one image can point at
# different backends/versions without a rebuild. Runs before nginx via its docker-entrypoint.d hook.
COPY docker/40-metrics-config.sh /docker-entrypoint.d/40-metrics-config.sh
RUN chmod +x /docker-entrypoint.d/40-metrics-config.sh
EXPOSE 80
