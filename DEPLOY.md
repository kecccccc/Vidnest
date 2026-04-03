# Deploying Vidnest

The server must have Node, yt-dlp, and ffmpeg. The Dockerfile in this repo installs those and serves the built frontend and the API on one port.

## Render (free tier)

1. Push the repo to GitHub or GitLab.
2. Create an account at [render.com](https://render.com) and connect the repository.
3. New Web Service, runtime Docker. Dockerfile path: `Dockerfile`, context: repo root, plan: Free.
4. Deploy. When the build finishes, Render shows a public HTTPS URL (for example `https://yourname.onrender.com`). That is the live site.

On the free tier the service may sleep when idle; the first request after that can take a while. Very large downloads may time out.

## Google Search

Google does not automatically index every new site. After you have a stable URL, add the property in [Google Search Console](https://search.google.com/search-console) and submit the sitemap at `https://your-url/sitemap.xml`. Indexing can take days or longer.

## Custom domain

In the Render service: Settings, Custom Domains, then follow the DNS instructions. Add the same hostname in Search Console if you use the sitemap there.

## Custom URL in metadata

Render sets `RENDER_EXTERNAL_URL`. The app uses that for `robots.txt` and `sitemap.xml`. You can also set `PUBLIC_URL` manually if needed.
