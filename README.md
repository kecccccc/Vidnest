# Vidnest

Small web app for pasting a YouTube playlist URL, listing tracks, unchecking what you do not want, and downloading audio as a ZIP (full playlist or only checked items).

Stack: React (Vite), Express, `yt-dlp`, ffmpeg. The API runs the downloads; the browser only talks to your server.

## Run locally (development)

```bash
npm install
npm run dev
```

Vite is on one port and the API on another; the dev server proxies `/api` to the backend.

## Run locally (production build)

```bash
npm install
npm run build
npm start
```

Then open the URL printed in the terminal (default port 3001).

## Deploy

See `DEPLOY.md` for hosting on Render with Docker (includes yt-dlp on the server).

## License

Use at your own risk. Respect YouTube’s terms and copyright.
