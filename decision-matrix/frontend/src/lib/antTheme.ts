import { theme, type ThemeConfig } from 'antd';

const LIGHT_PRIMARY = '#0b5cad';
const LIGHT_PRIMARY_HOVER = '#084a8f';
const DARK_PRIMARY = '#3d9cf5';
const DARK_PRIMARY_HOVER = '#6bb3f7';
const SIDEBAR_LIGHT = '#071a2e';
const SIDEBAR_DARK = '#050d16';

export function buildAntTheme(mode: 'light' | 'dark'): ThemeConfig {
  const isDark = mode === 'dark';
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: isDark ? DARK_PRIMARY : LIGHT_PRIMARY,
      colorPrimaryHover: isDark ? DARK_PRIMARY_HOVER : LIGHT_PRIMARY_HOVER,
      colorBgLayout: isDark ? '#0a111a' : '#eef2f7',
      colorBgContainer: isDark ? '#121c2a' : '#ffffff',
      colorBgElevated: isDark ? '#1a2638' : '#f0f4fa',
      colorBorder: isDark ? '#2e4058' : '#c8d4e4',
      colorText: isDark ? '#e8f0fa' : '#0f1c2e',
      colorTextSecondary: isDark ? '#8fa8c4' : '#5a6d85',
      borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif",
      zIndexPopupBase: 1100,
    },
    components: {
      Layout: {
        siderBg: isDark ? SIDEBAR_DARK : SIDEBAR_LIGHT,
        headerBg: isDark ? '#121c2a' : '#ffffff',
        bodyBg: isDark ? '#0a111a' : '#eef2f7',
      },
      Menu: {
        darkItemBg: isDark ? SIDEBAR_DARK : SIDEBAR_LIGHT,
        darkSubMenuItemBg: isDark ? SIDEBAR_DARK : SIDEBAR_LIGHT,
      },
      Card: {
        borderRadiusLG: 10,
        paddingLG: 16,
        headerBg: isDark ? '#1a2638' : '#f0f4fa',
      },
      Tabs: {
        inkBarColor: isDark ? DARK_PRIMARY : LIGHT_PRIMARY,
        itemActiveColor: isDark ? '#e8f0fa' : '#0f1c2e',
        itemColor: isDark ? '#8fa8c4' : '#5a6d85',
        itemHoverColor: isDark ? '#e8f0fa' : '#0f1c2e',
      },
      Form: {
        labelColor: isDark ? '#8fa8c4' : '#5a6d85',
        itemMarginBottom: 16,
      },
      Button: {
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
      },
    },
  };
}
