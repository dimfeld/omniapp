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
