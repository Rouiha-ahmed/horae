# HORAE

HORAE is a premium e-commerce experience for beauty, wellness, and parapharmacy products in Morocco. The storefront combines a cinematic navy-and-blue visual system with a complete shopping journey, customer accounts, loyalty rewards, order management, and an administration workspace.

The interface is in French and is fully responsive across desktop, tablet, and mobile devices.

## Highlights

- Premium dark storefront with responsive navigation and polished page transitions
- Animated home hero with smooth overlapping image crossfades and autoplay controls
- Product discovery by category, brand, promotion, search, and price
- Product details, cart, wishlist, checkout, and customer order history
- Clerk authentication and environment-controlled admin access
- HORAE loyalty tiers, points, rewards, and customer status management
- Cash-on-delivery and optional CMI card payment flows
- Optional WhatsApp order confirmations through Twilio
- Admin tools for products, categories, brands, promotions, orders, customers, and homepage content
- Optimized product and editorial media using Next.js Image and Sharp

## Technology

- [Next.js 16](https://nextjs.org/) with the App Router
- [React 19](https://react.dev/) and TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Motion](https://motion.dev/) for interface animation
- [Clerk](https://clerk.com/) for authentication
- [Prisma](https://www.prisma.io/) with PostgreSQL
- [Zustand](https://zustand.docs.pmnd.rs/) for cart and wishlist state
- Radix UI and shadcn/ui primitives
- CMI for optional online card payments
- Twilio for optional WhatsApp notifications

## Getting Started

### Requirements

- Node.js 20 or later
- npm
- PostgreSQL
- A Clerk application

### Installation

```bash
git clone <repository-url>
cd HORAE
npm install
cp .env.example .env
```

Complete the required values in `.env`, then prepare the database:

```bash
npm run db:setup
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Use [`.env.example`](./.env.example) as the source of truth for configuration.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection used by Prisma |
| `DATABASE_URL_POOLED` | No | Pooled database connection for compatible hosted runtimes |
| `NEXT_PUBLIC_BASE_URL` | Yes | Public application URL used for redirects and absolute URLs |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser key |
| `CLERK_SECRET_KEY` | Yes | Clerk server key |
| `ADMIN_EMAILS` / `ADMIN_USER_IDS` | Production | Users allowed to access `/admin` |
| `ORDER_AGENT_*` / `ORDER_MANAGER_*` | No | Optional order-operation role assignments |
| `CRON_SECRET` | No | Protects scheduled loyalty-expiration processing |
| `NEXT_PUBLIC_ENABLE_CMI` | No | Exposes CMI checkout when set to `true` |
| `CMI_CLIENT_ID` / `CMI_STORE_KEY` | With CMI | CMI merchant credentials |
| `TWILIO_*` | No | WhatsApp order-confirmation configuration |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Production | Stable Server Action encryption key |

Never commit real credentials or production secrets.

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js in development mode with Webpack |
| `npm run dev:turbo` | Start development mode with Turbopack |
| `npm run build` | Create a production build |
| `npm start` | Run the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the automated test suite |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Create and apply development migrations |
| `npm run db:deploy` | Apply checked-in migrations in production |
| `npm run db:push` | Synchronize the schema without a migration |
| `npm run db:seed` | Seed the demo catalog and homepage content |
| `npm run db:setup` | Generate, migrate, and seed in one command |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```text
app/
  (client)/              Public storefront pages and client-facing routes
  admin/                 Protected administration workspace
  api/                   Shared route handlers
actions/                 Checkout and order Server Actions
components/
  home/                  Homepage sections and renderers
  storefront/            Storefront header and footer
  admin/                 Administration components
  ui/                    Reusable interface primitives
lib/                     Queries, services, domain rules, and integrations
prisma/                  Schema, migrations, and seed scripts
public/static-assets/    Optimized catalog and editorial media
tests/                   Node-based domain and service tests
store.ts                 Persisted cart and wishlist store
```

## Main Routes

- `/` — configurable storefront homepage
- `/shop` — product catalog and filters
- `/product/[slug]` — product details
- `/category/[slug]` and `/brand/[slug]` — curated catalog views
- `/cart`, `/checkout`, and `/orders` — purchasing journey
- `/wishlist` — saved products
- `/loyalty` — HORAE loyalty program
- `/admin` — protected operations and content workspace

## Admin Access

HORAE uses the regular Clerk sign-in flow for customers and administrators. There is no separate admin login. Add an authorized Clerk email or user ID to `ADMIN_EMAILS` or `ADMIN_USER_IDS`, restart the application, sign in, and open `/admin`.

In local development only, a signed-in user is allowed into the admin area when both admin allowlists are empty. Production deployments must configure an explicit allowlist.

## Payments and Notifications

CMI is disabled by default. Enable it only after valid merchant credentials are configured by setting `NEXT_PUBLIC_ENABLE_CMI="true"`. Otherwise checkout continues to offer the supported manual payment flow.

WhatsApp confirmations are also optional. When the relevant Twilio variables are present, HORAE attempts to send a confirmation after a successful order. The application remains functional when Twilio is not configured.

## Deployment

HORAE can be deployed to Vercel or another Node.js-compatible platform.

1. Provision PostgreSQL and configure the environment variables.
2. Set `NEXT_PUBLIC_BASE_URL` to the production URL.
3. Configure explicit admin access and a stable Server Action encryption key.
4. Apply migrations with `npm run db:deploy`.
5. Build with `npm run build` and start with `npm start`.

Seed data only when initializing a new environment that requires the demo catalog.

For deeper implementation details, see [Application Documentation](./docs/APPLICATION_DOCUMENTATION.md) and [Database Setup](./DATABASE_SETUP.md).
