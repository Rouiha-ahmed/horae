# Zayna Application Documentation

## 1. Executive Summary

Zayna is an e-commerce parapharmacy application built with Next.js. It includes:

- a public storefront for browsing and buying products
- customer authentication with Clerk
- a shopping cart and wishlist stored in the browser
- checkout with Stripe for card payments
- manual order creation for cash on delivery and installment payments
- an admin dashboard for managing products, categories, brands, promo codes, and orders

The application is designed around a PostgreSQL database accessed through Prisma ORM.

## 2. Main Technologies and Tools

### Core application stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Clerk for authentication
- Prisma ORM
- PostgreSQL
- Stripe Checkout and Stripe webhook
- Zustand for cart and wishlist state
- shadcn/ui and Radix UI components
- Motion for UI animations
- Sharp for image compression and resizing

### Development tools

- ESLint for code quality
- Prisma Migrate for schema migration
- Prisma Studio for direct database inspection
- tsx for running seed scripts

## 3. High-Level Functional Scope

### Public storefront

- Home page
- Shop page with category, brand, search, and price filters
- Product detail pages
- Category pages
- Brand pages
- Cart
- Wishlist
- Orders history
- Checkout

### Admin area

- Dashboard metrics
- Orders monitoring
- Order status updates
- Product management
- Category management
- Brand management
- Promo code management
- Media upload with optimization

## 4. Project Structure

```text
app/
  (client)/           Public storefront routes and API routes used by the client
  admin/              Admin layout, UI, and server actions
  api/assets/         Legacy image serving route for old file-based assets
components/           Shared UI and business components
components/admin/     Admin-specific UI building blocks
actions/              Checkout and manual order server actions
lib/                  Shared services, queries, admin helpers, media logic
prisma/               Prisma schema, migration, seed script
public/static-assets/ Optimized uploaded images
images/               Legacy image source folder
store.ts              Zustand cart and wishlist store
```

## 5. Runtime Architecture

### Main application layers

1. UI layer
   - Next.js pages and React components render the storefront and admin dashboard.
2. Server layer
   - Next.js server actions and route handlers process writes and business workflows.
3. Data layer
   - Prisma reads and writes PostgreSQL.
4. External services
   - Clerk handles sign-in and session identity.
   - Stripe handles card checkout and payment confirmation.
5. Media layer
   - Uploaded images are optimized with Sharp and stored in `public/static-assets`.

## 6. Authentication and Admin Access

### Customer login

Customer login uses Clerk.

- The public application is wrapped in `ClerkProvider`.
- Sign-in is triggered with a Clerk modal from the UI.
- Clerk middleware runs on app routes and API routes.

### How admin login works

There is no separate admin login page. Admin access is based on a normal Clerk user account plus environment-based authorization.

### Admin authorization rules

Admin access is decided by:

- `ADMIN_EMAILS`
- `ADMIN_USER_IDS`

If the signed-in Clerk user matches one of those values, the user is considered admin.

### Development fallback

In local development only:

- if both `ADMIN_EMAILS` and `ADMIN_USER_IDS` are empty
- and `NODE_ENV` is not `production`

then the signed-in user is allowed into `/admin`.

This fallback must not be relied on in production.

### How to log in as admin

1. Create or use a normal Clerk account in the application.
2. Find the Clerk email or Clerk user id of that account.
3. Put it in `.env`.

Example:

```env
ADMIN_EMAILS="admin@example.com"
ADMIN_USER_IDS=""
```

or:

```env
ADMIN_EMAILS=""
ADMIN_USER_IDS="user_123456"
```

4. Restart the application.
5. Sign in.
6. Open `/admin`.

### Admin access behavior

- If the user is not signed in, the admin layout redirects to `/`.
- If the user is signed in but not authorized, the admin area shows an access denied screen.
- All admin write actions also re-check admin authorization on the server.

## 7. Environment Variables

Minimum environment variables:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/zayna"
DATABASE_URL_POOLED=""
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
ADMIN_EMAILS="admin@example.com"
ADMIN_USER_IDS=""
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
STRIPE_SECRET_KEY="sk_test_replace_me"
STRIPE_WEBHOOK_SECRET="whsec_replace_me"
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

### Purpose of each variable

- `DATABASE_URL`: PostgreSQL connection string for Prisma
- `DATABASE_URL_POOLED`: optional pooled runtime connection string for hosted/serverless production
- `NEXT_PUBLIC_BASE_URL`: base URL used by Stripe redirect URLs and absolute image URLs
- `ADMIN_EMAILS`: comma-separated list of Clerk emails allowed in admin
- `ADMIN_USER_IDS`: comma-separated list of Clerk user ids allowed in admin
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk frontend key
- `CLERK_SECRET_KEY`: Clerk server key
- `STRIPE_SECRET_KEY`: Stripe server secret
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signature secret
- `TWILIO_ACCOUNT_SID`: optional Twilio account SID for WhatsApp notifications
- `TWILIO_AUTH_TOKEN`: optional Twilio auth token for WhatsApp notifications
- `TWILIO_WHATSAPP_FROM`: optional Twilio WhatsApp sender, typically `whatsapp:+...`
- `TWILIO_WHATSAPP_ORDER_TEMPLATE_SID`: optional Twilio content/template SID for order confirmations
- `TWILIO_WHATSAPP_DEFAULT_COUNTRY_CODE`: optional default country code used to normalize local phone numbers
- `NEXT_PUBLIC_ENABLE_CMI`: optional public flag that exposes the CMI card option in checkout
- `CMI_CLIENT_ID`: optional CMI merchant client id, required only when CMI card checkout is enabled
- `CMI_STORE_KEY`: optional CMI signing key, required only when CMI card checkout is enabled
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`: stable base64-encoded 32-byte key for server action encryption across deploys

## 8. Database Overview

The application uses PostgreSQL through Prisma.

### Main entities

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

### Database design principles

- products and categories use a many-to-many relation
- product images are stored in a dedicated table
- orders keep snapshots of product data at purchase time
- users are linked to Clerk through `clerkUserId`
- promo codes are stored centrally and validated server-side

## 9. Database Table Reference

### `User`

Purpose: application-level customer record synchronized from Clerk identity.

Important fields:

- `clerkUserId`
- `email`
- `fullName`
- `loyaltyCardNumber`
- `loyaltyPoints`
- `loyaltyTier`
- `installmentsEligible`
- `stripeCustomerId`

Rules:

- created or updated automatically when authenticated users interact with checkout-related flows
- one user per Clerk account
- loyalty card number is generated automatically

### `Address`

Purpose: customer delivery addresses.

Important fields:

- `userId`
- `name`
- `address`
- `city`
- `phone`
- `state`
- `zip`
- `isDefault`

Rules:

- belongs to one user
- first address becomes default automatically
- when a new address is created as default, previous defaults are unset

### `Category`

Purpose: product grouping for navigation and merchandising.

Important fields:

- `title`
- `slug`
- `description`
- `featured`
- `imageUrl`

Rules:

- slug is generated automatically in admin
- admin UI does not expose the slug

### `Brand`

Purpose: manufacturer or brand grouping.

Important fields:

- `title`
- `slug`
- `description`
- `imageUrl`

Rules:

- slug is generated automatically in admin
- one brand can be linked to many products

### `Product`

Purpose: sellable catalog item.

Important fields:

- `name`
- `slug`
- `description`
- `price`
- `discount`
- `stock`
- `status`
- `isFeatured`
- `brandId`

Rules:

- slug is generated automatically in admin
- brand is optional
- at least one category is required in admin
- at least one image is required when creating a product
- a product can have up to 6 uploaded images in admin

### `ProductImage`

Purpose: store ordered product images.

Important fields:

- `productId`
- `url`
- `altText`
- `sortOrder`

Rules:

- images are ordered by `sortOrder`
- first image is treated as the main display image in many screens

### `ProductCategory`

Purpose: join table between products and categories.

Important fields:

- `productId`
- `categoryId`
- `assignedAt`

Rules:

- composite primary key prevents duplicate product/category pairs

### `PromoCode`

Purpose: server-side discount rules.

Important fields:

- `title`
- `code`
- `active`
- `discountType`
- `discountValue`
- `minimumOrderAmount`
- `allowedPaymentMethods`
- `startsAt`
- `endsAt`
- `usageLimit`
- `usedCount`

Rules:

- code is normalized to uppercase
- code uniqueness is enforced
- promo validation checks dates, payment methods, minimum amount, active flag, and usage limit

### `Order`

Purpose: commercial order header.

Important fields:

- `orderNumber`
- `userId`
- `clerkUserId`
- `customerName`
- `email`
- `status`
- `paymentStatus`
- `paymentMethod`
- `totalPrice`
- `promoCode`
- `promoDiscount`
- `orderDate`
- shipping fields
- Stripe identifiers

Rules:

- `orderNumber` is unique
- card orders come from Stripe webhook completion
- cash on delivery and installment orders are created directly by the app

### `OrderItem`

Purpose: purchased line items.

Important fields:

- `orderId`
- `productId`
- `productNameSnapshot`
- `productPriceSnapshot`
- `productImageUrlSnapshot`
- `quantity`

Rules:

- snapshots preserve the sale record even if the product changes later

## 10. Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Address : has
    User ||--o{ Order : places
    Brand ||--o{ Product : owns
    Product ||--o{ ProductImage : has
    Product ||--o{ OrderItem : appears_in
    Order ||--o{ OrderItem : contains
    Product ||--o{ ProductCategory : linked_to
    Category ||--o{ ProductCategory : linked_to

    User {
      string id
      string clerkUserId
      string email
      string fullName
      string loyaltyCardNumber
      int loyaltyPoints
      enum loyaltyTier
      boolean installmentsEligible
      string stripeCustomerId
    }

    Address {
      string id
      string userId
      string name
      string address
      string city
      string phone
      string state
      string zip
      boolean isDefault
    }

    Category {
      string id
      string title
      string slug
      boolean featured
      string imageUrl
    }

    Brand {
      string id
      string title
      string slug
      string imageUrl
    }

    Product {
      string id
      string name
      string slug
      decimal price
      int discount
      int stock
      enum status
      boolean isFeatured
      string brandId
    }

    ProductImage {
      string id
      string productId
      string url
      int sortOrder
    }

    ProductCategory {
      string productId
      string categoryId
    }

    PromoCode {
      string id
      string title
      string code
      boolean active
      enum discountType
      decimal discountValue
    }

    Order {
      string id
      string orderNumber
      string userId
      string clerkUserId
      string customerName
      string email
      enum status
      enum paymentStatus
      enum paymentMethod
      decimal totalPrice
    }

    OrderItem {
      string id
      string orderId
      string productId
      string productNameSnapshot
      decimal productPriceSnapshot
      int quantity
    }
```

## 11. Business Rules

### Catalog rules

- Product slug, category slug, brand slug, and promo code are generated automatically in admin.
- The admin UI intentionally hides ids, slugs, and raw image paths.
- Product status is derived automatically:
  - discount greater than `0` => `sale`
  - otherwise if featured => `hot`
  - otherwise => `new`
- A product must belong to at least one category.
- A product can optionally belong to one brand.

### Inventory rules

- Stock is checked before order creation.
- Stock is decremented when a manual order is created.
- Stock is also decremented when a Stripe checkout is confirmed by webhook.
- Orders keep product snapshots so historic orders stay readable even if catalog data changes later.

### Customer rules

- App user records are created or updated automatically from Clerk identity.
- Loyalty card number is auto-generated.
- Installment payment availability depends on `User.installmentsEligible`.
- Address book belongs to authenticated users only.

### Promo rules

- Promo codes are validated on the server.
- Validation checks:
  - promo exists
  - promo is active
  - start date is valid
  - end date is not expired
  - payment method is allowed
  - subtotal meets minimum order amount
  - usage limit is not exceeded
- Promo usage count increments after a successful order.
- In the current admin UI implementation, promo codes are managed as percentage discounts, enabled for all payment methods, with no minimum order amount by default.

### Order rules

Customer-facing payment methods:

- `cmi_card` => Stripe card checkout
- `cod` => cash on delivery
- `installments` => manual order with installment metadata

Default order creation behavior:

- Stripe card checkout creates orders with `status = paid` and `paymentStatus = paid`
- cash on delivery creates orders with `status = pending` and `paymentStatus = pending`
- installments create orders with `status = pending` and `paymentStatus = partial`

Stored order statuses in database:

- `pending`
- `processing`
- `paid`
- `shipped`
- `out_for_delivery`
- `delivered`
- `cancelled`

Admin-facing status labels:

- Pending
- Confirmed
- Preparing
- Shipped
- Delivered
- Cancelled

Admin to database mapping:

- `Pending` => `pending`
- `Confirmed` => `processing`
- `Preparing` => `paid`
- `Shipped` => `shipped`
- `Delivered` => `delivered`
- `Cancelled` => `cancelled`

Additional order rule:

- if an admin marks a cash-on-delivery order as delivered, payment status is automatically updated to `paid`

### Dashboard rules

- revenue metric is based on orders with `paymentStatus = paid`
- pending orders metric groups `pending`, `processing`, `paid`, `shipped`, and `out_for_delivery` through admin stage mapping
- low-stock products are currently products with stock less than or equal to `5`

## 12. Public Route Map

Main public pages:

- `/` home
- `/shop` product listing and filters
- `/deal` featured products
- `/category/[slug]` category page
- `/brand/[slug]` brand page
- `/product/[slug]` product detail page
- `/cart` shopping cart
- `/wishlist` wishlist
- `/orders` customer order history
- `/success` post-checkout success page
- `/contact`
- `/about`
- `/privacy`
- `/terms`

Main client API routes:

- `/api/navigation`
- `/api/products/search`
- `/api/products/by-category`
- `/api/checkout-context`
- `/api/addresses`
- `/api/promo/validate`
- `/api/webhook`
- `/api/assets/[...path]` legacy asset serving

## 13. Admin Functional Scope

### Dashboard

- total orders
- total revenue
- pending orders
- products count
- categories count
- brands count
- promo counts
- low stock summary
- recent orders
- recent customers

### Orders management

- list recent orders
- inspect line items
- inspect delivery info
- inspect payment method and payment status
- change order stage from the admin interface

### Products management

- create product
- edit product
- delete product
- upload multiple product images

### Categories management

- create category
- edit category
- delete category
- upload category image

### Brands management

- create brand
- edit brand
- delete brand
- upload brand logo

### Promo management

- create promo code
- edit promo code
- delete promo code
- toggle active state
- set expiration date

## 14. Image and Media Architecture

### Current image strategy

New admin uploads are processed through Sharp and stored in:

```text
public/static-assets/
  brands/
  brands/thumbs/
  categories/
  categories/thumbs/
  products/
  products/thumbs/
```

### Upload pipeline

1. Admin uploads image from the form.
2. Server action validates file type and size.
3. Sharp rotates and resizes the image.
4. The image is converted to WebP.
5. A thumbnail is generated.
6. Files are stored under `public/static-assets`.
7. The database stores the public URL.

### Image rules

- maximum upload size: 5 MB per file
- only image MIME types are accepted
- output format: WebP
- thumbnails are generated automatically
- old replaced files are deleted during updates

### Resize rules by entity

- brand images: max 900x900, thumbnail width 240
- category images: max 1200x1200, thumbnail width 320
- product images: max 1600x1600, thumbnail width 420

### Performance model

- images are served as static files from `public/static-assets`
- thumbnails support smaller previews
- frontend uses Next.js `Image`
- legacy `/api/assets/...` URLs are normalized to `/static-assets/...` when possible
- the structure is CDN-ready because assets are under public static paths

### Legacy asset compatibility

Older seed and legacy assets may still exist under `images/` and can still be served through `/api/assets/[...path]`.

## 15. Checkout and Order Architecture

### Card payment flow

1. Authenticated user opens cart.
2. App loads checkout context and user addresses.
3. User applies promo code if needed.
4. Server action creates Stripe Checkout session.
5. Stripe handles payment.
6. Stripe sends webhook on `checkout.session.completed`.
7. Webhook creates order in database.
8. Stock is reduced.
9. Promo usage is incremented.
10. User lands on success page.

### Manual order flow for cash on delivery and installments

1. Authenticated user chooses `cod` or `installments`.
2. App validates cart, address, stock, and promo.
3. Server creates order directly in database.
4. Stock is reduced immediately.
5. Promo usage is incremented.
6. User is redirected to success page.

### Checkout flow diagram

```mermaid
flowchart LR
    A[Customer Cart Page] --> B[Select address and payment method]
    B --> C{Payment method}
    C -->|Card| D[createCheckoutSession server action]
    D --> E[Stripe Checkout]
    E --> F[Stripe webhook]
    F --> G[createOrderFromStripeSession]
    G --> H[(PostgreSQL)]

    C -->|COD or Installments| I[createManualOrder server action]
    I --> J[createManualOrderRecord]
    J --> H
```

## 16. System Architecture Diagram

```mermaid
flowchart TD
    Browser[Browser]
    PublicUI[Public Storefront]
    AdminUI[Admin Dashboard]
    Actions[Server Actions]
    APIs[Route Handlers / API Routes]
    Clerk[Clerk]
    Stripe[Stripe]
    Prisma[Prisma ORM]
    DB[(PostgreSQL)]
    Media[public/static-assets]

    Browser --> PublicUI
    Browser --> AdminUI
    PublicUI --> Actions
    PublicUI --> APIs
    AdminUI --> Actions
    PublicUI --> Clerk
    AdminUI --> Clerk
    Actions --> Prisma
    APIs --> Prisma
    Prisma --> DB
    Actions --> Stripe
    Stripe --> APIs
    Actions --> Media
    PublicUI --> Media
    AdminUI --> Media
```

## 17. Admin and Media Flow Diagram

```mermaid
flowchart LR
    A[Admin UI Form] --> B[Server Action]
    B --> C{Authorization}
    C -->|Admin OK| D[Validate fields]
    D --> E[Optimize images with Sharp]
    E --> F[Save files to public/static-assets]
    D --> G[Write catalog data with Prisma]
    F --> G
    G --> H[Revalidate storefront and admin pages]
    H --> I[Updated public catalog]
```

## 18. Commands

### Application

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

### Database

```bash
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:push
npm run db:seed
npm run db:setup
npm run db:studio
```

### Stripe local webhook

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

## 19. Important Implementation Notes

- The admin UI hides technical fields, but the database still stores slugs, ids, and URLs internally.
- Cart and wishlist are client-side persisted with Zustand.
- Prisma is singleton-managed to avoid excessive client creation in development.
- Public storefront pages use server data and revalidation for better performance.
- Uploaded images are optimized, but legacy assets may still exist in the old `images/` folder.
- File storage is local filesystem storage. For multi-server production scaling, this should later move to shared object storage or a CDN-backed media service.

## 20. Recommended Next Improvements

- move all legacy `images/` assets to `public/static-assets` and remove old fallback serving
- add explicit audit logs for admin actions
- add role-based admin levels if more than one back-office role is needed
- add automated tests for promo rules, order creation, and admin authorization
- move uploaded media to cloud object storage for easier horizontal scaling
