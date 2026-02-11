This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Toolforge

This app is deployed on [Wikimedia Toolforge](https://wikitech.wikimedia.org/wiki/Portal:Toolforge) as tool `archiverua` at `https://archiverua.toolforge.org`.

### Initial deploy

```bash
# 1. Connect to Toolforge
ssh YOUR_WIKIMEDIA_USER@login.toolforge.org

# 2. Switch to tool account
become archiverua

# 3. Prepare directory and clone repo
mkdir -p ~/www/js
cd ~/www/js
git clone https://github.com/YOUR_USERNAME/archiverua.git .

# 4. Copy service.template to tool home directory
cp ~/www/js/service.template ~/service.template

# 5. Start webservice (build takes ~3-5 min)
toolforge webservice node20 start

# 6. Check logs
toolforge webservice node20 logs
```

### Updating

```bash
cd ~/www/js && git pull
toolforge webservice node20 restart
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

**Create secrets on Toolforge:**
```bash
toolforge envvars create AUTH_SECRET "..."
toolforge envvars create AUTH_WIKIMEDIA_ID "..."
toolforge envvars create AUTH_WIKIMEDIA_SECRET "..."
toolforge envvars create AUTH_URL "https://archiverua.toolforge.org"
toolforge envvars create OAUTH_CID "..."
```

**List / delete secrets:**
```bash
toolforge envvars list
toolforge envvars delete AUTH_SECRET
```

> **Note:** For local development, copy these values to `.env.local`. This file is gitignored and must **never** be committed.

### Verification

- App: `https://archiverua.toolforge.org`
- Healthcheck: `https://archiverua.toolforge.org/api/healthz` → `{"status":"ok"}`
