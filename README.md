# Zayna

 Zayna is a Next.js ecommerce/parapharmacy storefront using Clerk for authentication, Prisma for data access, PostgreSQL for persistence, and CMI plus manual payment flows for checkout.

Full project documentation is available in [docs/APPLICATION_DOCUMENTATION.md](./docs/APPLICATION_DOCUMENTATION.md).

## Stack

- Next.js App Router
- Clerk
- Prisma ORM
- PostgreSQL
- CMI payment gateway + manual order flow

## Environment Variables

Create `.env` from `.env.example` and fill:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zayna"
DATABASE_URL_POOLED=""
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
ADMIN_EMAILS="admin@example.com"
ADMIN_USER_IDS=""

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_FROM=""
TWILIO_WHATSAPP_ORDER_TEMPLATE_SID=""
TWILIO_WHATSAPP_DEFAULT_COUNTRY_CODE="+212"
NEXT_PUBLIC_ENABLE_CMI="false"
CMI_CLIENT_ID=""
CMI_STORE_KEY=""
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="replace_with_base64_32_byte_key"
```

Prisma CLI reads from `.env` in this repo.

`ADMIN_EMAILS` controls who can access `/admin`. In local development, if you do not set `ADMIN_EMAILS` or `ADMIN_USER_IDS`, the admin area falls back to allowing the signed-in user.

`DATABASE_URL_POOLED` is optional and useful for hosted/serverless production runtimes that need a pooled Postgres connection.

Set `NEXT_PUBLIC_ENABLE_CMI="true"` only when `CMI_CLIENT_ID` and `CMI_STORE_KEY` are configured for production. Otherwise the storefront keeps the CMI payment option hidden and falls back to cash on delivery only.

WhatsApp order confirmations are optional. If `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` are configured, the app will try to send a WhatsApp confirmation when an order is successfully created or paid. If `TWILIO_WHATSAPP_ORDER_TEMPLATE_SID` is set, Twilio template messaging is used. Otherwise the app falls back to a plain text body, which may still be rejected by WhatsApp outside the allowed customer-service window.

## Install

```bash
npm install
```

## Database Setup

If you want the full step-by-step guide, see [DATABASE_SETUP.md](./DATABASE_SETUP.md).

Generate the Prisma client:

```bash
npm run db:generate
```

Create and apply the checked-in local migration:

```bash
npm run db:migrate
```

If you only want to sync schema without creating a migration:

```bash
npm run db:push
```

Seed demo catalog data:

```bash
npm run db:seed
```

Run the full local database setup in one command:

```bash
npm run db:setup
```

The seed creates demo categories, brands, promo codes, and products using the local repository images exposed through `/api/assets/...`.

## Run Locally

```bash
npm run dev
```

App URL:

```bash
http://localhost:3000
```

## Build

```bash
npm run build
```

## Deployment Notes

- Deploy on Vercel with the same env vars from `.env.example`.
- Provision a PostgreSQL database and set `DATABASE_URL`.
- Optionally set `DATABASE_URL_POOLED` if your production database provider gives you a pooled/runtime connection string.
- Set `NEXT_PUBLIC_BASE_URL` to your real production URL, not `localhost`.
- Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable base64-encoded 32-byte key.
- Set `ADMIN_EMAILS` or `ADMIN_USER_IDS` before opening `/admin` in production.
- Enable CMI only when `NEXT_PUBLIC_ENABLE_CMI`, `CMI_CLIENT_ID`, and `CMI_STORE_KEY` are all configured.
- Run Prisma migrations during deployment with:

```bash
npm run db:deploy
```

- Seed only when you need demo data in a fresh environment:

```bash
npm run db:seed
```
