FROM node:20-alpine AS base
WORKDIR /app

COPY manfac-site/package.json manfac-site/package-lock.json ./
RUN npm ci

COPY manfac-site/ .
RUN npm run build

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
