# Backend

NestJS and TypeScript API for the short-form video app.

## Run locally

```bash
cd backend
npm install
cp .env.example .env
# Replace the placeholder CLERK_SECRET_KEY in .env with your Clerk secret key.
npm run start:dev
```

The API listens on port `3000` by default. Set `PORT` to use another port.

The public health route is `GET http://localhost:3000/v1/health`.

`GET http://localhost:3000/v1/me` requires a Clerk session token:

```http
Authorization: Bearer <Clerk session token>
```

For now, the route returns the verified Clerk user ID. The local profile record
and final `/v1/me` response will be added with the database migration. Set
`CLERK_AUTHORIZED_PARTIES` to the comma-separated client origins once the mobile
origins are known; configure this allowlist before production.
