import { useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs } from 'antd';

export type SubnavTab = {
  key: string;
  label: ReactNode;
  to: string;
};

type Props = {
  tabs: SubnavTab[];
  ariaLabel: string;
};

export function SubnavTabs({ tabs, ariaLabel }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeKey = useMemo(() => {
    const match = [...tabs]
      .sort((a, b) => b.to.length - a.to.length)
      .find((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`));
    return match?.key ?? tabs[0]?.key ?? '';
  }, [pathname, tabs]);

  if (tabs.length === 0) return null;

  return (
    <Tabs
      className="dm-subnav-tabs"
      aria-label={ariaLabel}
      activeKey={activeKey}
      onChange={(key) => {
        const tab = tabs.find((t) => t.key === key);
        if (tab) navigate(tab.to);
      }}
      items={tabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
      }))}
      style={{ marginBottom: 0 }}
    />
  );
}
