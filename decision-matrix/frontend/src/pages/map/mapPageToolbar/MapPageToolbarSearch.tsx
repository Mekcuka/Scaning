import { useRef } from 'react';
import { Search } from 'lucide-react';
import { AnchoredMenu } from '../../../components/AnchoredMenu';
import type { MapSearchHit } from '../../../lib/mapSearch';

export type MapPageToolbarSearchProps = {
  searchQ: string;
  onSearchQChange: (q: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  searchSuggestions: MapSearchHit[];
  onPickSearchResult: (hit: MapSearchHit) => void;
};

export function MapPageToolbarSearch({
  searchQ,
  onSearchQChange,
  searchOpen,
  onSearchOpenChange,
  searchSuggestions,
  onPickSearchResult,
}: MapPageToolbarSearchProps) {
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const searchBlurRef = useRef<number | null>(null);

  return (
    <div ref={searchAnchorRef} className="map-tools-group map-tools-group--search relative">
      <Search
        size={14}
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none"
      />
      <input
        type="search"
        className="w-full text-sm py-1.5 pl-7 pr-2 rounded-md border bg-transparent"
        style={{ borderColor: 'var(--border)' }}
        placeholder="Название, подтип, свойства…"
        value={searchQ}
        onChange={(e) => {
          onSearchQChange(e.target.value);
          onSearchOpenChange(true);
        }}
        onFocus={() => {
          if (searchBlurRef.current) window.clearTimeout(searchBlurRef.current);
          onSearchOpenChange(true);
        }}
        onBlur={() => {
          searchBlurRef.current = window.setTimeout(() => onSearchOpenChange(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onSearchOpenChange(false);
          if (e.key === 'Enter' && searchSuggestions[0]) {
            e.preventDefault();
            onPickSearchResult(searchSuggestions[0]);
          }
        }}
      />
      <AnchoredMenu
        anchorRef={searchAnchorRef}
        open={searchOpen && !!searchQ.trim()}
        onClose={() => onSearchOpenChange(false)}
        className="app-anchored-menu--flat"
        ariaLabel="Результаты поиска"
      >
        {searchSuggestions.length === 0 ? (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Ничего не найдено
          </div>
        ) : (
          searchSuggestions.map((hit) => (
            <button
              key={`${hit.kind}-${hit.id}`}
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] border-b last:border-b-0"
              style={{ borderColor: 'var(--border)' }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPickSearchResult(hit)}
            >
              <div className="truncate font-medium">{hit.name}</div>
              <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {hit.subtitle}
              </div>
            </button>
          ))
        )}
      </AnchoredMenu>
    </div>
  );
}
