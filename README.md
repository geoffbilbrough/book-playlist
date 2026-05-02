# BookPlaylist

AI-powered web app that analyses a book's mood, themes, and atmosphere, then generates a 15-song Spotify playlist to match.

**Live app:** https://book-playlist-production.up.railway.app

---

## How it works

1. User enters a book title and author
2. Claude AI (Anthropic) analyses the book and suggests 15 songs
3. The app searches Spotify for each song
4. If the user is logged in with Spotify, they can save the playlist to their account

---

## Accounts and dashboards

You will need to log in to these services to manage the app:

| Service | Dashboard URL | What it's for |
|---|---|---|
| Anthropic | https://console.anthropic.com | API keys, billing, usage |
| Spotify Developer | https://developer.spotify.com/dashboard | App settings, user management |
| Railway | https://railway.app | Hosting, deployment, logs, environment variables |
| GitHub | https://github.com/geoffbilbrough/book-playlist | Source code |

---

## Codebase structure

```
book-playlist/
├── server.js                  # Main Express server
├── package.json               # Dependencies
├── .env                       # Local environment variables (never commit this)
├── .env.example               # Template for environment variables
├── routes/
│   ├── auth.js                # Spotify OAuth login/logout/callback
│   ├── analyze.js             # Claude AI book analysis
│   └── spotify.js             # Spotify search and playlist creation
└── public/
    ├── index.html             # Frontend HTML
    ├── style.css              # Styles
    └── app.js                 # Frontend JavaScript
```

---

## Environment variables

These are set in Railway for production and in your local `.env` file for development.

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |
| `SPOTIFY_CLIENT_ID` | https://developer.spotify.com/dashboard → your app → Settings |
| `SPOTIFY_CLIENT_SECRET` | https://developer.spotify.com/dashboard → your app → Settings |
| `SPOTIFY_REDIRECT_URI` | Set to `https://book-playlist-production.up.railway.app/callback` in production |
| `SESSION_SECRET` | Any long random string — keep it secret |
| `NODE_ENV` | Set to `production` on Railway |

---

## Running locally

```bash
cd ~/book-playlist
npm install
npm start
```

Then visit **https://localhost:3000** in your browser. Accept the self-signed certificate warning (click Advanced → Proceed).

The local `.env` file must have `SPOTIFY_REDIRECT_URI=https://localhost:3000/callback` and that URL must be added to your Spotify app's Redirect URIs in the developer dashboard.

---

## Deploying changes

Any code change follows this process:

```bash
cd ~/book-playlist
git add .
git commit -m "Description of what you changed"
git push origin main
```

Railway automatically detects the push and redeploys within 2–3 minutes. Watch the progress at https://railway.app.

---

## Spotify user limits (important)

Your Spotify app is in **Development Mode**, which limits you to **5 authorised users**. Anyone can visit the site and generate a playlist, but only users you've added can log in with Spotify and save playlists.

**To add a user:**
1. Go to https://developer.spotify.com/dashboard
2. Click your app → Settings → User Management
3. Add their Spotify account email address

**To allow unlimited users**, you need to apply for Extended Quota Mode:
1. Go to https://developer.spotify.com/dashboard
2. Click your app → Settings → Request Extended Quota
3. Fill in the form describing your app — Spotify will review it

---

## Managing API costs

**Anthropic (Claude AI)**
- You are charged per API call based on tokens used
- Monitor usage at https://console.anthropic.com → Usage
- Each playlist generation costs roughly $0.05–0.15 depending on the book
- Set spend limits at https://console.anthropic.com → Billing → Usage limits

**Railway (hosting)**
- Hobby plan costs $5/month flat fee plus usage
- Monitor at https://railway.app → your project → Metrics

---

## Spotify API changes

In February 2026, Spotify updated their Web API and renamed several endpoints. The app has been updated to use the new endpoints:
- Playlist track management now uses `/v1/playlists/{id}/items` (was `/tracks`)
- Search results are limited to 10 per query in Development Mode

If Spotify makes further API changes, check: https://developer.spotify.com/blog

---

## Troubleshooting

**"Invalid x-api-key" error**
- Your Anthropic API key is wrong or expired
- Go to https://console.anthropic.com → API Keys, create a new key
- Update `ANTHROPIC_API_KEY` in Railway → Variables

**"Not authenticated with Spotify"**
- Your session has expired — click Sign out then Connect Spotify again

**"Failed to create Spotify playlist"**
- Most likely a Spotify API issue — check https://developer.spotify.com/blog for any new changes
- Check Railway deploy logs for the specific error

**Connect Spotify not working / redirect error**
- Make sure `SPOTIFY_REDIRECT_URI` in Railway Variables matches exactly what's in the Spotify Developer Dashboard (no trailing slash, must be `https://`)

**Changes not appearing on the live site**
- Check Railway → your project → Deployments to confirm the latest deploy succeeded
- If it failed, check the deploy logs for errors

---

## If you need to rotate API keys

1. **Anthropic:** Go to https://console.anthropic.com → API Keys → Create new key → update Railway variable → delete old key
2. **Spotify:** Go to https://developer.spotify.com/dashboard → your app → Settings → Client secret → Rotate → update Railway variable
3. **Session secret:** Update `SESSION_SECRET` in Railway → all existing user sessions will be invalidated (users will need to log in again)
