import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { resolvePageHeader, type PageHeaderConfig } from '../../lib/resolvePageHeader';

type PageHeaderOverride = Partial<PageHeaderConfig> & {
  actions?: ReactNode;
};

type PageHeaderState = PageHeaderConfig & {
  actions?: ReactNode;
};

type PageHeaderContextValue = {
  setOverride: (override: PageHeaderOverride | null) => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

function mergeHeader(
  base: PageHeaderConfig | null,
  override: PageHeaderOverride | null,
): PageHeaderState | null {
  const title = override?.title ?? base?.title;
  if (!title) return null;
  return {
    title,
    subtitle: override?.subtitle !== undefined ? override.subtitle : base?.subtitle,
    actions: override?.actions,
  };
}

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [overrideEntry, setOverrideEntry] = useState<{
    path: string;
    value: PageHeaderOverride | null;
  } | null>(null);

  const override =
    overrideEntry?.path === pathname ? (overrideEntry.value ?? null) : null;

  const base = useMemo(() => resolvePageHeader(pathname), [pathname]);
  const header = useMemo(() => mergeHeader(base, override), [base, override]);

  const value = useMemo(
    () => ({
      setOverride: (next: PageHeaderOverride | null) => {
        setOverrideEntry({ path: pathname, value: next });
      },
    }),
    [pathname],
  );

  return (
    <PageHeaderContext.Provider value={value}>
      <PageHeaderStateContext.Provider value={header}>{children}</PageHeaderStateContext.Provider>
    </PageHeaderContext.Provider>
  );
}

const PageHeaderStateContext = createContext<PageHeaderState | null>(null);

export function usePageHeaderState(): PageHeaderState | null {
  return useContext(PageHeaderStateContext);
}

export function usePageHeader(config: PageHeaderOverride | null, deps: readonly unknown[] = []) {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setOverride(config);
    return () => ctx.setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps for dynamic fields
  }, [ctx, ...deps]);
}

type PageHeaderOutletProps = {
  actionsClassName?: string;
};

export function PageHeaderOutlet({ actionsClassName = 'app-header-page-actions' }: PageHeaderOutletProps) {
  const header = usePageHeaderState();
  if (!header) return null;

  return (
    <>
      <div className="app-header-page">
        <h1 className="app-header-page__title">{header.title}</h1>
        {header.subtitle ? (
          <p className="app-header-page__subtitle">{header.subtitle}</p>
        ) : null}
      </div>
      {header.actions ? <div className={actionsClassName}>{header.actions}</div> : null}
    </>
  );
}
