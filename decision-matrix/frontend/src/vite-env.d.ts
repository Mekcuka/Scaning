/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BASE_PATH?: string;
  /** When "true", MapPage shows 2D/3D toggle and loads MapLibre view. */
  readonly VITE_MAP_3D_ENABLED?: string;
  /** MapTiler API key for terrain-rgb DEM in 3D mode. */
  readonly VITE_MAPTILER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
