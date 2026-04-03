import { useCallback, useId, useState } from 'react'
import {
  downloadPlaylistZip,
  fetchPlaylist,
  type PlaylistEntry,
} from './api'

function looksLikePlaylistUrl(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  if (!s) return false
  return (
    s.includes('youtube.com/playlist') ||
    (s.includes('youtube.com/watch') && s.includes('list=')) ||
    (s.startsWith('http') && s.includes('list='))
  )
}

type TrackRow = PlaylistEntry & { selected: boolean }

function VidnestMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={`vn-grad-${uid}`}
          x1="6"
          y1="4"
          x2="34"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ff6b6b" />
          <stop offset="0.55" stopColor="#e03131" />
          <stop offset="1" stopColor="#991b1b" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="11"
        fill={`url(#vn-grad-${uid})`}
      />
      <path
        d="M8 27c4.5-2.2 9.5-3.4 14.5-3.4 5.2 0 10.4 1.3 15 3.8"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M10 30.5c4-1.8 8.3-2.7 12.7-2.7 4.8 0 9.6 1 14.3 3"
        stroke="white"
        strokeOpacity="0.14"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path d="M15 11 L15 29 L29 20 Z" fill="white" fillOpacity="0.96" />
      <circle cx="31" cy="9" r="2.25" fill="#fecaca" fillOpacity="0.9" />
    </svg>
  )
}

function HeroWaveform({ className }: { className?: string }) {
  const heightsPct = [
    32, 40, 48, 58, 72, 84, 94, 100, 88, 72, 58, 72, 88, 100, 94, 84, 72, 58,
    48, 40,
  ]
  const barW = 3.25
  const gap = 5
  const maxH = 46
  const n = heightsPct.length
  const width = n * barW + (n - 1) * gap
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${maxH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {heightsPct.map((pct, i) => {
        const barH = (pct / 100) * maxH
        const x = i * (barW + gap)
        const y = maxH - barH
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={1.625}
            className="fill-white/90"
          />
        )
      })}
    </svg>
  )
}

export default function App() {
  const fieldId = useId()
  const listId = useId()
  const [url, setUrl] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadMode, setDownloadMode] = useState<'all' | 'selected' | null>(
    null,
  )
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)

  const checkedCount = tracks.filter((t) => t.selected).length

  const loadPlaylist = useCallback(async () => {
    const trimmed = url.trim()
    setDownloadError(null)
    if (!trimmed) {
      setHint('Paste a playlist link first.')
      setTracks([])
      setPlaylistUrl(null)
      return
    }
    if (!looksLikePlaylistUrl(trimmed)) {
      setHint('Use a YouTube playlist URL (it should contain list=…).')
      setTracks([])
      setPlaylistUrl(null)
      return
    }
    setHint(null)
    setLoadError(null)
    setLoadingList(true)
    setTracks([])
    setPlaylistUrl(null)
    try {
      const entries = await fetchPlaylist(trimmed)
      setTracks(entries.map((e) => ({ ...e, selected: true })))
      setPlaylistUrl(trimmed)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load playlist.'
      setLoadError(msg)
    } finally {
      setLoadingList(false)
    }
  }, [url])

  const submit = useCallback(() => {
    void loadPlaylist()
  }, [loadPlaylist])

  const toggleTrack = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)),
    )
    setDownloadError(null)
  }, [])

  const selectAll = useCallback(() => {
    setTracks((prev) => prev.map((t) => ({ ...t, selected: true })))
    setDownloadError(null)
  }, [])

  const deselectAll = useCallback(() => {
    setTracks((prev) => prev.map((t) => ({ ...t, selected: false })))
    setDownloadError(null)
  }, [])

  const handleDownloadAll = useCallback(async () => {
    if (!playlistUrl) return
    setDownloadError(null)
    setDownloading(true)
    setDownloadMode('all')
    try {
      await downloadPlaylistZip(playlistUrl, 'all', undefined)
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed.')
    } finally {
      setDownloading(false)
      setDownloadMode(null)
    }
  }, [playlistUrl])

  const handleDownloadChecked = useCallback(async () => {
    if (!playlistUrl) return
    const ids = tracks.filter((t) => t.selected).map((t) => t.id)
    if (ids.length === 0) {
      setDownloadError('Check at least one track, or use “Download the entire playlist”.')
      return
    }
    setDownloadError(null)
    setDownloading(true)
    setDownloadMode('selected')
    try {
      await downloadPlaylistZip(playlistUrl, 'selected', ids)
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed.')
    } finally {
      setDownloading(false)
      setDownloadMode(null)
    }
  }, [playlistUrl, tracks])

  const showPanel = loadingList || loadError || tracks.length > 0

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,77,77,0.18),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[100%_24px]"
        aria-hidden
      />

      <header className="border-b border-white/[0.06] px-6 py-5 md:px-10">
        <div className="mx-auto flex max-w-5xl items-center gap-3.5 select-none">
          <VidnestMark className="h-11 w-11 shrink-0 md:h-12 md:w-12" />
          <span className="text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">
            Vidnest
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 md:px-8 md:py-24">
        <div className="mb-10 text-center md:mb-14">
          <div className="mb-6 flex justify-center md:mb-7">
            <HeroWaveform className="h-10 w-[min(20rem,100%)] max-w-[20rem] md:h-12" />
          </div>
          <h1 className="mb-4 text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Download a YouTube playlist in one place
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-base text-zinc-400 md:text-lg">
            Paste your playlist link, uncheck anything you want to skip, then
            download everything or only the tracks you left checked.
          </p>
        </div>

        <form
          className="w-full"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label htmlFor={fieldId} className="sr-only">
            YouTube playlist URL
          </label>
          <div className="rounded-2xl border border-white/[0.08] bg-surface-elevated/80 p-2 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.04] backdrop-blur-sm md:p-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                id={fieldId}
                type="url"
                name="playlist-url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://www.youtube.com/playlist?list=…"
                value={url}
                disabled={loadingList || downloading}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setHint(null)
                }}
                className="min-h-14 flex-1 rounded-xl border border-transparent bg-black/40 px-4 py-3.5 text-base text-white placeholder:text-zinc-600 outline-none transition focus:border-red-500/40 focus:ring-2 focus:ring-red-500/25 disabled:opacity-60 md:min-h-16 md:px-5 md:text-lg"
              />
              <button
                type="submit"
                disabled={loadingList || downloading}
                className="shrink-0 rounded-xl bg-[var(--color-accent)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60 md:px-8 md:text-base"
              >
                {loadingList ? 'Loading…' : 'Continue'}
              </button>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-zinc-500">
            Press{' '}
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.7rem] text-zinc-400">
              Enter
            </kbd>{' '}
            in the field to load the playlist
          </p>
        </form>

        {hint && (
          <p
            className="mt-4 text-center text-sm text-amber-400/90"
            role="status"
          >
            {hint}
          </p>
        )}

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            showPanel ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <section
              className="mt-10 rounded-2xl border border-white/[0.08] bg-surface-elevated/60 p-6 backdrop-blur-md md:p-8"
              aria-hidden={!showPanel}
              aria-labelledby={listId}
            >
              {loadingList && (
                <p className="text-center text-sm text-zinc-400">
                  Fetching videos from the playlist…
                </p>
              )}

              {loadError && (
                <p
                  className="text-center text-sm text-red-400/90"
                  role="alert"
                >
                  {loadError}
                </p>
              )}

              {!loadingList && tracks.length > 0 && (
                <>
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 id={listId} className="text-lg font-semibold text-white md:text-xl">
                        Tracks ({tracks.length})
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        Uncheck songs you do not want. They will not be included
                        when you use the second download option.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={downloading}
                        onClick={selectAll}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        Check all
                      </button>
                      <button
                        type="button"
                        disabled={downloading}
                        onClick={deselectAll}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        Uncheck all
                      </button>
                    </div>
                  </div>

                  <ul
                    className="mb-6 max-h-[min(24rem,50svh)] space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/25 p-2"
                    role="list"
                  >
                    {tracks.map((t, i) => (
                      <li key={t.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04]">
                          <input
                            type="checkbox"
                            checked={t.selected}
                            disabled={downloading}
                            onChange={() => toggleTrack(t.id)}
                            className="mt-1 size-4 shrink-0 rounded border-white/20 bg-black/40 text-[var(--color-accent)] focus:ring-red-500/40"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="mr-2 text-xs text-zinc-600 tabular-nums">
                              {i + 1}.
                            </span>
                            <span className="text-sm text-zinc-200">{t.title}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      disabled={downloading || !playlistUrl}
                      onClick={handleDownloadAll}
                      className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-transparent bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[200px]"
                    >
                      {downloading && downloadMode === 'all'
                        ? 'Preparing…'
                        : 'Download the entire playlist'}
                    </button>
                    <button
                      type="button"
                      disabled={
                        downloading || !playlistUrl || checkedCount === 0
                      }
                      onClick={handleDownloadChecked}
                      title={
                        checkedCount === 0
                          ? 'Check at least one track'
                          : undefined
                      }
                      className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[200px]"
                    >
                      {downloading && downloadMode === 'selected'
                        ? 'Preparing…'
                        : 'Download checked tracks only'}
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-zinc-500">
                    The first button downloads every video in the playlist (your
                    checkboxes are ignored). The second downloads only checked
                    items; unchecked tracks are skipped. Audio is saved as
                    separate files inside a ZIP.
                  </p>
                  {downloadError && (
                    <p className="mt-3 text-sm text-red-400/90" role="alert">
                      {downloadError}
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] px-6 py-8 md:px-10">
        <p className="mx-auto max-w-5xl text-center text-xs leading-relaxed text-zinc-600">
          For personal, fair-use downloads only. Not affiliated with YouTube.
          Respect creators and platform terms.
        </p>
      </footer>
    </div>
  )
}
