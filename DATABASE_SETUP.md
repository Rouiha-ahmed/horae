# Database Setup

This project uses Prisma with PostgreSQL.

## 1. Install PostgreSQL

Install PostgreSQL locally and make sure you know:

- the PostgreSQL username
- the PostgreSQL password
- the port, usually `5432`

## 2. Create the database

Option A: use Prisma to create it during migration.

If your PostgreSQL user can create databases, Prisma can create the `zayna`
database automatically when you run migrations.

Option B: create it manually with SQL.

Open `psql` or pgAdmin while connected to the default `postgres` database, then run:

```sql
CREATE DATABASE zayna;
```

The same SQL is also available in [prisma/create-database.sql](./prisma/create-database.sql).

## 3. Configure environment variables

Copy `.env.example` into `.env` and set your real database credentials.

Prisma CLI reads `DATABASE_URL` from `.env` in this repo. If you also use
`.env.local` for Next.js, keep the values in sync.

Example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zayna"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
```

## 4. Install dependencies

```bash
npm install
```

## 5. Generate the Prisma client

```bash
npm run db:generate
```

## 6. Create the tables

Run the checked-in initial migration:

```bash
npm run db:migrate
```

If you only want to sync the schema without using migrations:

```bash
npm run db:push
```

## 7. Insert demo data

```bash
npm run db:seed
```

Or run the full local setup in one command:

```bash
npm run db:setup
```

## 8. Inspect the database

```bash
npm run db:studio
```

## 9. Start the app

```bash
npm run dev
```

The local app URL is:

```text
http://localhost:3000
```

## What gets created

The initial migration creates these main tables:

- `User`
- `Address`
- `Category`
- `Brand`
- `Product`
- `ProductImage`
- `ProductCategory`
- `PromoCode`
- `Order`
- `OrderItem`
