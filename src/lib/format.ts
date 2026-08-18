export function maskUrl(url: string): string {
  return url.replace(
    /^(https?:\/\/)([^/]+)(.*)$/,
    (_, proto: string, host: string) => `${proto}${host.slice(0, 4)}•••••`,
  )
}
