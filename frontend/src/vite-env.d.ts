/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL prepended to every API request.
   * - Empty/undefined (default): same-origin requests; expected in production where
   *   a reverse proxy (Caddy/nginx) forwards `/api/*` to the api service.
   * - Full URL (e.g. `https://your-dev-tunnel.example.com`): point `vite dev` at an
   *   external backend. Set in `frontend/.env.local` (gitignored).
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
