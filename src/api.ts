export type PlaylistEntry = { id: string; title: string }

async function parseJsonError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    if (j.error) return j.error
  } catch {
    void 0
  }
  return res.statusText || 'Request failed'
}

export async function fetchPlaylist(url: string): Promise<PlaylistEntry[]> {
  const res = await fetch('/api/playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  const data = (await res.json()) as { entries: PlaylistEntry[] }
  return data.entries
}

export async function downloadPlaylistZip(
  playlistUrl: string,
  mode: 'all' | 'selected',
  videoIds: string[] | undefined,
): Promise<void> {
  const res = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playlistUrl,
      mode,
      videoIds: mode === 'selected' ? videoIds : undefined,
    }),
  })
  if (!res.ok) {
    throw new Error(await parseJsonError(res))
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition')
  let filename = 'playlist.zip'
  if (cd) {
    const m =
      /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(cd)
    if (m) {
      filename = decodeURIComponent((m[1] || m[2] || m[3]).trim())
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
