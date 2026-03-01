This is a [Next.js](https://nextjs.org) project.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploy on Toolforge

This app is deployed on [Wikimedia Toolforge](https://wikitech.wikimedia.org/wiki/Portal:Toolforge) as tool `wikiarchiver` at `https://wikiarchiver.toolforge.org`.

### Initial deploy

```bash
# 1. Connect to Toolforge
ssh YOUR_WIKIMEDIA_USER@login.toolforge.org

# 2. Switch to tool account
become wikiarchiver

# 3. Trigger the first build (buildpack runs npm ci + next build)
toolforge build start https://github.com/kavryn/archiverua.git

# 4. Wait for build to succeed
toolforge build show

# 5. Start webservice using the pre-built image
toolforge webservice buildservice start --mount none

# 6. Check logs
toolforge webservice buildservice logs
```

### Updating

```bash
# Push your changes to GitHub, then on Toolforge:
toolforge build start https://github.com/kavryn/archiverua.git
# Wait for ok(Succeeded)
toolforge build show
toolforge webservice buildservice restart --mount none
```

### Updating environment variables / Secrets

The app requires the following environment variables, which must be set as Toolforge secrets:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Random secret used to sign JWT session tokens (generate with `npx auth secret`) |
| `AUTH_WIKIMEDIA_ID` | OAuth 2.0 Client ID from [Special:OAuthConsumerRegistration](https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration) |
| `AUTH_WIKIMEDIA_SECRET` | OAuth 2.0 Client Secret for the registered consumer |
| `AUTH_URL` | Public base URL of the app (must match the callback URL registered with Wikimedia) |
| `OAUTH_CID` | Numeric OAuth Consumer ID used to filter user contributions by this app's uploads (different for test and production) |
| `NEXT_PUBLIC_SENTRY_DSN` | *(Optional)* Sentry DSN for error monitoring. If not set, Sentry is disabled. Get it from your Sentry project settings. |

**Create secrets on Toolforge:**
```bash
toolforge envvars create AUTH_SECRET "..."
toolforge envvars create AUTH_WIKIMEDIA_ID "..."
toolforge envvars create AUTH_WIKIMEDIA_SECRET "..."
toolforge envvars create AUTH_URL "https://wikiarchiver.toolforge.org"
toolforge envvars create OAUTH_CID "..."
toolforge envvars create NEXT_PUBLIC_SENTRY_DSN "https://...@sentry.io/..."
```

**List / delete secrets:**
```bash
toolforge envvars list
toolforge envvars delete AUTH_SECRET
```

> **Note:** For local development, copy these values to `.env.local`. This file is gitignored and must **never** be committed.

### Verification

- App: `https://wikiarchiver.toolforge.org`
- Healthcheck: `https://wikiarchiver.toolforge.org/api/healthz` → `{"status":"ok"}`
