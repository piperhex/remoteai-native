import { theme } from 'antd';
import type { CSSProperties } from 'react';

/** File-browser hosts supply --pf tokens; standalone previews inherit their application theme. */
export function usePdfTheme(): CSSProperties {
  const { token } = theme.useToken();
  return { fontFamily: token.fontFamily, fontSize: token.fontSize,
    color: `var(--pf-ink, var(--ink, ${token.colorText}))`,
    '--pdf-border': `var(--pf-border, var(--line, ${token.colorBorderSecondary}))`,
    '--pdf-surface': `var(--pf-surface, var(--panel, ${token.colorBgContainer}))`,
    '--pdf-subtle': `var(--pf-subtle, var(--bg, ${token.colorFillQuaternary}))`,
    '--pdf-hover': `var(--pf-hover, ${token.colorFillTertiary})`,
    '--pdf-accent': `var(--pf-accent, var(--green, ${token.colorPrimary}))`,
    '--pdf-selected': `var(--pf-selected, ${token.colorPrimaryBg})`,
  } as CSSProperties;
}
