/** Icons for the documentation navigation: pages, sections, activity button. */

/** A page glyph for a leaf documentation entry. */
export function DocPageIcon(): JSX.Element {
  return (
    <span className="tree-icon" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path
          d="M4 2.2h5l3 3v8.6a.6.6 0 0 1-.6.6H4a.6.6 0 0 1-.6-.6V2.8a.6.6 0 0 1 .6-.6z"
          fill="#7fb2c8"
          fillOpacity="0.18"
          stroke="#7fb2c8"
          strokeWidth="1"
        />
        <path d="M9 2.4v3h3" fill="none" stroke="#7fb2c8" strokeWidth="1" />
        <path
          d="M5.4 8h5.2M5.4 10.4h5.2"
          stroke="#7fb2c8"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** A book glyph for a section: closed when collapsed, open when expanded. */
export function DocSectionIcon({ open }: { open: boolean }): JSX.Element {
  const tint = '#c8a76a';
  return (
    <span className="tree-icon" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16">
        {open ? (
          <path
            d="M8 4.4C6.7 3.3 5 2.9 2.6 3.1a.6.6 0 0 0-.6.6v8a.6.6 0 0 0 .65.6c2.2-.18 3.8.2 4.95 1.2 1.15-1 2.75-1.38 4.95-1.2a.6.6 0 0 0 .65-.6v-8a.6.6 0 0 0-.6-.6C11.05 2.9 9.3 3.3 8 4.4z"
            fill={tint}
            fillOpacity="0.22"
            stroke={tint}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M4 2.4h8a.6.6 0 0 1 .6.6v10a.6.6 0 0 1-.6.6H4a1.6 1.6 0 0 1-1.6-1.6V4a1.6 1.6 0 0 1 1.6-1.6zM2.4 11.4A1.6 1.6 0 0 1 4 10.6h8.6"
            fill={tint}
            fillOpacity="0.22"
            stroke={tint}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        )}
        <path d="M8 4.4v8.6" stroke={tint} strokeWidth="0.8" opacity={open ? 1 : 0} />
      </svg>
    </span>
  );
}

/** The activity-bar docs button glyph (larger, monochrome, matches Explorer). */
export function DocsIcon(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 7.2C10.2 5.6 7.8 5 4.6 5.3a1.1 1.1 0 0 0-1 1.1v10.2a1.1 1.1 0 0 0 1.2 1.1c2.9-.26 5 .3 6.5 1.6a1 1 0 0 0 1.4 0c1.5-1.3 3.6-1.86 6.5-1.6a1.1 1.1 0 0 0 1.2-1.1V6.4a1.1 1.1 0 0 0-1-1.1C16.2 5 13.8 5.6 12 7.2z"
        fill="currentColor"
      />
      <path d="M12 7.4v11.4" stroke="var(--bg-panel)" strokeWidth="1.3" />
    </svg>
  );
}
