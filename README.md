# Omni

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv@0.17.0 create --template minimal --types ts --add vitest="usages:unit,component" tailwindcss="plugins:none" sveltekit-adapter="adapter:node" experimental="versions:none+features:async,remoteFunctions" --install bun .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Local database

Omni uses `bun:sqlite`. The default database file is `data/omni.sqlite`. Set
`OMNI_DATABASE_PATH` to use a different file.

The server runs pending migrations when it opens the database. To add a migration, add the next
version to the `migrations` array in `src/lib/server/database.ts`. Each migration runs in one
transaction. The `schema_migrations` table records each applied version.

Run the production server with Bun because the package tracker uses `bun:sqlite`.

## FedEx package tracking

Set `FEDEX_CLIENT_ID` and `FEDEX_CLIENT_SECRET` to enable FedEx tracking. The server checks new
FedEx packages immediately and checks active packages again each hour.

The production API base is `https://apis.fedex.com`. For FedEx sandbox credentials, set:

```sh
FEDEX_API_BASE_URL=https://apis-sandbox.fedex.com
```

## Amazon price watch

The price watch checks Amazon.com products when added and then every two hours. It uses the
[Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/get-started/using-curl).
Set these server environment variables to enable price checks:

```sh
AMAZON_CREATORS_CLIENT_ID=...
AMAZON_CREATORS_CLIENT_SECRET=...
AMAZON_CREATORS_VERSION=3.1
AMAZON_PARTNER_TAG=...
```

Set `AMAZON_CREATORS_VERSION` to the version assigned to your credentials (3.1, 3.2, or 3.3).
Price targets use USD and Amazon.com offers. The API price can differ from the price a shopper sees.

For browser push notifications, generate a VAPID key pair with `npx web-push generate-vapid-keys`
and set `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT` (a `mailto:`
address or HTTPS URL) on the server. Keep the private key outside source control. Users then
select **Enable notifications** on the price watch page. The app banner works without push setup.
The production server must stay running for scheduled checks and push delivery.
