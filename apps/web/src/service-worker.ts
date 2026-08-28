/**
 * A cached page that never learns it is stale is the worst failure mode for a
 * link someone was sent: they see an old build forever with no reason to
 * suspect it.
 *
 * GitHub Pages serves assets with a ten-minute max-age, so the browser can
 * hand back a cached `sw.js` and the update check quietly does nothing.
 * `updateViaCache: 'none'` takes the worker script out of that cache; the poll
 * covers a tab left open across a deploy.
 *
 * Registered by hand rather than through `virtual:pwa-register`, which needs
 * `workbox-window` as a dependency and does not expose `updateViaCache`.
 */
export function keepFresh(): void {
  if (!('serviceWorker' in navigator)) return

  const base = import.meta.env.BASE_URL
  // On a first-ever visit the worker claims the page immediately. That is not
  // a stale page, and reloading it would be a flash for no reason.
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
      .then((registration) => {
        void registration.update()
        setInterval(() => void registration.update(), 60_000)
      })
      .catch(() => {
        // No offline support then. Not a reason to break the page.
      })
  })
}
