FROM node:20-alpine
WORKDIR /repo

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY shared ./shared
COPY frontend ./frontend

RUN npm install --workspaces --include-workspace-root=false
RUN npm run build -w @manufacturing-agent/shared && npm run build -w @manufacturing-agent/frontend

WORKDIR /repo/frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
