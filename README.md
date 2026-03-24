This is a [Next.js](https://nextjs.org) project.

## Getting Started

First, run the development server:

```bash
npm run dev
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

# 3. Configure runtime env variables and secrets (see another section below)

# 4. Trigger the first build (buildpack runs npm ci + next build)
# Pass NEXT_PUBLIC_* variables here because Next.js inlines them at build time
toolforge build start \
  --envvar NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..." \
  https://github.com/kavryn/archiverua.git

# 5. Start webservice using the pre-built image
toolforge webservice buildservice start

# 6. Check logs
toolforge webservice buildservice logs
```

### Updating

```bash
# Push your changes to GitHub, then execute on Toolforge:
toolforge build start \
  --envvar NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..." \
  https://github.com/kavryn/archiverua.git
# Restart service
toolforge webservice buildservice restart
```

### Updating environment variables / Secrets

Runtime variables:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Random secret used to sign JWT session tokens (generate with `npx auth secret`) |
| `AUTH_WIKIMEDIA_ID` | OAuth 2.0 Client ID from [Special:OAuthConsumerRegistration](https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration) |
| `AUTH_WIKIMEDIA_SECRET` | OAuth 2.0 Client Secret for the registered consumer |
| `AUTH_URL` | Public base URL of the app (must match the callback URL registered with Wikimedia) |
| `OAUTH_CID` | Numeric OAuth Consumer ID used to filter user contributions by this app's uploads (different for test and production) |
| `DIRECT_UPLOAD` | Optional runtime flag. Direct upload is enabled by default; set `DIRECT_UPLOAD=false` to force proxy upload. |
| `NEXT_PUBLIC_SENTRY_DSN` | *(Optional)* Also set this as a runtime env var if you want Sentry enabled on the server. |

Build-time variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | *(Optional)* Sentry DSN for error monitoring. If not set during build, Sentry is disabled in the client bundle. Client-side Sentry is tunneled through `/monitoring` on the same origin. |

**Create runtime secrets on Toolforge:**
```bash
toolforge envvars create AUTH_SECRET "..."
toolforge envvars create AUTH_WIKIMEDIA_ID "..."
toolforge envvars create AUTH_WIKIMEDIA_SECRET "..."
toolforge envvars create AUTH_URL "https://wikiarchiver.toolforge.org"
toolforge envvars create OAUTH_CID "..."
toolforge envvars create DIRECT_UPLOAD "false"
toolforge envvars create NEXT_PUBLIC_SENTRY_DSN "https://...@sentry.io/..."
```

**Pass build-time values when creating the image:**
```bash
toolforge build start \
  --envvar NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..." \
  https://github.com/kavryn/archiverua.git
```

`NEXT_PUBLIC_SENTRY_DSN` is used in both server and client Sentry configs in this project, so it needs to be set in both places.
**List / delete secrets:**
```bash
toolforge envvars list
toolforge envvars delete AUTH_SECRET
```

> **Note:** For local development, copy these values to `.env.local`. This file is gitignored and must **never** be committed.

### Verification

- App: `https://wikiarchiver.toolforge.org`
- Healthcheck: `https://wikiarchiver.toolforge.org/api/healthz` → `{"status":"ok"}`
