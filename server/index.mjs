import archiver from 'archiver'
import cors from 'cors'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'
import { createWriteStream, existsSync } from 'fs'
import { mkdir, readFile, readdir, rm } from 'fs/promises'
import express from 'express'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

const GOOGLE_SITE_VERIFICATION =
  'GO7Ka8IQtLhFP7fKY-x_ThrRmvvHbTY0Ma9ZuqbwJBQ'

const PORT = Number(process.env.PORT) || 3001
const app = express()

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

app.use(cors())
app.use(express.json({ limit: '512kb' }))

function isAllowedYoutubeUrl(raw) {
  try {
    const u = new URL(raw.trim())
    const h = u.hostname.replace(/^www\./, '')
    if (h === 'youtu.be') return true
    if (!h.endsWith('youtube.com')) return false
    if (u.pathname.includes('/playlist')) return true
    if (u.searchParams.get('list')) return true
    return false
  } catch {
    return false
  }
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    proc.stderr.on('data', (c) => {
      stderr += c
    })
    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = stderr.trim() || `yt-dlp exited with code ${code}`
        reject(new Error(msg))
      } else resolve()
    })
  })
}

function runYtDlpStdout(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (c) => {
      stdout += c
    })
    proc.stderr.on('data', (c) => {
      stderr += c
    })
    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = stderr.trim() || `yt-dlp exited with code ${code}`
        reject(new Error(msg))
      } else resolve(stdout)
    })
  })
}

function parsePlaylistDump(stdout) {
  const entries = []
  for (const line of stdout.trim().split('\n')) {
    if (!line) continue
    try {
      const j = JSON.parse(line)
      if (j.id && typeof j.title === 'string') {
        entries.push({ id: j.id, title: j.title })
      }
    } catch {}
  }
  return entries
}

async function zipFolderToFile(sourceDir, zipPath) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 5 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/playlist', async (req, res) => {
  const url = req.body?.url
  if (!url || typeof url !== 'string' || !isAllowedYoutubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid or unsupported YouTube playlist URL.' })
  }
  try {
    const stdout = await runYtDlpStdout([
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--skip-download',
      url.trim(),
    ])
    const entries = parsePlaylistDump(stdout)
    if (entries.length === 0) {
      return res.status(422).json({
        error:
          'No videos found. The playlist may be private, empty, or unavailable.',
      })
    }
    res.json({ entries })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load playlist.'
    res.status(502).json({ error: message })
  }
})

app.post('/api/download', async (req, res) => {
  const playlistUrl = req.body?.playlistUrl
  const mode = req.body?.mode
  const videoIds = req.body?.videoIds

  if (!playlistUrl || typeof playlistUrl !== 'string' || !isAllowedYoutubeUrl(playlistUrl)) {
    return res.status(400).json({ error: 'Invalid playlist URL.' })
  }
  if (mode !== 'all' && mode !== 'selected') {
    return res.status(400).json({ error: 'Invalid download mode.' })
  }
  if (mode === 'selected') {
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({
        error: 'Select at least one track, or use “Download the entire playlist”.',
      })
    }
    if (!videoIds.every((id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id))) {
      return res.status(400).json({ error: 'Invalid video id list.' })
    }
  }

  const workDir = join(tmpdir(), `pl-dl-${Date.now()}-${randomBytes(4).toString('hex')}`)
  const zipPath = join(
    tmpdir(),
    `playlist-${Date.now()}-${randomBytes(4).toString('hex')}.zip`,
  )
  const outTemplate = join(workDir, '%(title)s [%(id)s].%(ext)s')

  try {
    await mkdir(workDir, { recursive: true })

    if (mode === 'all') {
      await runYtDlp([
        '-f',
        'bestaudio/best',
        '-o',
        outTemplate,
        '--no-warnings',
        playlistUrl.trim(),
      ])
    } else {
      const urls = videoIds.map((id) => `https://www.youtube.com/watch?v=${id}`)
      await runYtDlp(['-f', 'bestaudio/best', '-o', outTemplate, '--no-warnings', ...urls])
    }

    const files = await readdir(workDir)
    if (files.length === 0) {
      throw new Error('Download finished but no files were written.')
    }

    await zipFolderToFile(workDir, zipPath)
    await rm(workDir, { recursive: true, force: true })

    const filename = `playlist-${Date.now()}.zip`
    res.download(zipPath, filename, (err) => {
      rm(zipPath, { force: true }).catch(() => {})
      if (err && !res.headersSent) {
        console.error(err)
      }
    })
  } catch (e) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
    await rm(zipPath, { force: true }).catch(() => {})
    const message = e instanceof Error ? e.message : 'Download failed.'
    if (!res.headersSent) {
      res.status(502).json({ error: message })
    }
  }
})

function publicBaseUrlFromEnv() {
  const raw =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_URL ||
    ''
  return raw.replace(/\/$/, '')
}

function resolvePublicBase(req) {
  const fromEnv = publicBaseUrlFromEnv()
  if (fromEnv) return fromEnv
  const proto = req.get('x-forwarded-proto') || 'http'
  const host = req.get('host')
  if (host) return `${proto}://${host}`.replace(/\/$/, '')
  return ''
}

app.get('/robots.txt', (req, res) => {
  const base = resolvePublicBase(req)
  res.type('text/plain')
  if (base) {
    res.send(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`)
  } else {
    res.send('User-agent: *\nAllow: /\n')
  }
})

app.get('/sitemap.xml', (req, res) => {
  const base = resolvePublicBase(req)
  res.type('application/xml')
  if (!base) {
    return res
      .status(503)
      .type('text/plain')
      .send('Configure RENDER_EXTERNAL_URL, PUBLIC_URL, or access via Host header.')
  }
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`)
})

function ensureGoogleSiteVerification(html) {
  if (html.includes(`content="${GOOGLE_SITE_VERIFICATION}"`)) return html
  const tag = `<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}" />`
  return html.replace(/<head\s*>/i, `<head>\n${tag}\n`)
}

async function sendIndexHtml(res) {
  const fp = join(distDir, 'index.html')
  let html = await readFile(fp, 'utf8')
  html = ensureGoogleSiteVerification(html)
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.type('text/html; charset=utf-8').send(html)
}

if (existsSync(distDir)) {
  app.get('/', async (req, res, next) => {
    try {
      await sendIndexHtml(res)
    } catch (err) {
      next(err)
    }
  })
  app.get('/index.html', async (req, res, next) => {
    try {
      await sendIndexHtml(res)
    } catch (err) {
      next(err)
    }
  })
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: '1d',
    }),
  )
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) return next()
    try {
      await sendIndexHtml(res)
    } catch (err) {
      next(err)
    }
  })
}

const server = app.listen(PORT, '0.0.0.0', () => {
  const mode = existsSync(distDir) ? 'API + static' : 'API only'
  console.log(`Listening on port ${PORT} (${mode})`)
})

server.timeout = 0
server.requestTimeout = 0
server.headersTimeout = 0
