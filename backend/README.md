# Backend

NestJS and TypeScript API scaffold for the short-form video app.

## Run locally

```bash
cd backend
npm install
npm run start:dev
```

The API listens on port `3000` by default. Set `PORT` to use another port.

Check the health route:

```bash
curl http://localhost:3000/v1/health
```

Expected response:

```json
{"status":"ok"}
```
