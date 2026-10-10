FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 5190
# vite preview phục vụ bản build và chuyển tiếp /api sang API_TARGET (xem vite.config.ts).
CMD ["npx", "vite", "preview", "--host", "--port", "5190", "--strictPort"]
