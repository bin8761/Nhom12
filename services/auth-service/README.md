# Auth Login Service

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill values
3. `npx prisma migrate deploy`
4. `npm run dev`

## Login API
POST `/api/auth/login`

Body:
```json
{ "email": "user@example.com", "password": "password123", "deviceId": "dev1" }
```
