FROM node:20-alpine
WORKDIR /repo

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY shared ./shared
COPY orchestrator ./orchestrator

RUN npm install -w @manufacturing-agent/shared -w @manufacturing-agent/orchestrator --include-workspace-root=false --ignore-scripts
RUN npm run build -w @manufacturing-agent/shared && npm run build -w @manufacturing-agent/orchestrator

WORKDIR /repo/orchestrator
EXPOSE 3000
CMD ["npm", "run", "start"]
