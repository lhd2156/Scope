FROM node:20-alpine AS build
WORKDIR /workspace/atlas-frontend

ARG VITE_API_BASE_URL=/
ARG VITE_MAPBOX_TOKEN=
ARG VITE_CSRF_ENDPOINT=
ARG VITE_DEMO_MODE=false
ARG VITE_ENABLE_AUTH_MOCK_FALLBACK=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN \
    VITE_CSRF_ENDPOINT=$VITE_CSRF_ENDPOINT \
    VITE_DEMO_MODE=$VITE_DEMO_MODE \
    VITE_ENABLE_AUTH_MOCK_FALLBACK=$VITE_ENABLE_AUTH_MOCK_FALLBACK

COPY atlas-frontend/package*.json ./
RUN npm ci
COPY atlas-frontend/ ./
COPY atlas-assets ../atlas-assets
RUN npm run build

FROM nginx:alpine
COPY --from=build /workspace/atlas-frontend/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n  location = /healthz { return 200; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
