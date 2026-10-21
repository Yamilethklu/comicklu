FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
# ffmpeg del sistema (con filtro drawtext para los subtítulos; el de npm no lo trae), espeak-ng (voz local gratis) y fuentes
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
ENV FFMPEG_PATH=/usr/bin/ffmpeg
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
RUN mkdir -p /data/uploads
ENV UPLOAD_DIR=/data/uploads
EXPOSE 5000
CMD ["node", "dist/server.js"]
