/** Small, self-contained SVG/badge icons for the VS Code-like file tree. */

interface FileType {
  label: string;
  bg: string;
  fg: string;
}

// Extension → colored monogram badge, roughly matching common editor palettes.
const FILE_TYPES: Record<string, FileType> = {
  ts: { label: 'TS', bg: '#3178c6', fg: '#ffffff' },
  mts: { label: 'TS', bg: '#3178c6', fg: '#ffffff' },
  cts: { label: 'TS', bg: '#3178c6', fg: '#ffffff' },
  tsx: { label: 'TSX', bg: '#3178c6', fg: '#ffffff' },
  js: { label: 'JS', bg: '#e8d44d', fg: '#2b2b2b' },
  mjs: { label: 'JS', bg: '#e8d44d', fg: '#2b2b2b' },
  cjs: { label: 'JS', bg: '#e8d44d', fg: '#2b2b2b' },
  jsx: { label: 'JSX', bg: '#e8d44d', fg: '#2b2b2b' },
  py: { label: 'PY', bg: '#3572a5', fg: '#ffffff' },
  rs: { label: 'RS', bg: '#dea584', fg: '#2b2b2b' },
  json: { label: '{}', bg: '#cbcb41', fg: '#2b2b2b' },
  md: { label: 'MD', bg: '#519aba', fg: '#ffffff' },
  css: { label: '#', bg: '#563d7c', fg: '#ffffff' },
  html: { label: '<>', bg: '#e34c26', fg: '#ffffff' },
  yml: { label: 'Y', bg: '#cb171e', fg: '#ffffff' },
  yaml: { label: 'Y', bg: '#cb171e', fg: '#ffffff' },
  svg: { label: '▲', bg: '#ff9800', fg: '#2b2b2b' },
};

const GENERIC: FileType = { label: '·', bg: '#5a5a52', fg: '#dddddd' };

function typeForName(name: string): FileType {
  const dot = name.lastIndexOf('.');
  const ext = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  return FILE_TYPES[ext] ?? GENERIC;
}

/** A crisp colored monogram badge indicating the file type. */
export function FileIcon({ name }: { name: string }): JSX.Element {
  const type = typeForName(name);
  return (
    <span
      className="tree-icon file-badge"
      style={{
        background: type.bg,
        color: type.fg,
        fontSize: type.label.length >= 3 ? 6 : 8,
      }}
      aria-hidden
    >
      {type.label}
    </span>
  );
}

/** An amber folder glyph; the open variant is used for expanded directories. */
export function FolderIcon({ open }: { open: boolean }): JSX.Element {
  // A defined folder silhouette (tab + body) with an outline so it reads as a
  // folder against the dark sidebar. Open shows a lifted front flap.
  const body = '#dcb67a';
  const edge = '#c79b57';
  return (
    <span className="tree-icon" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16">
        {open ? (
          <>
            <path
              d="M1.5 3.75h4.1l1.4 1.5H14a.9.9 0 0 1 .9.9v.6H4.6a1 1 0 0 0-.94.66L1.5 13V4.65a.9.9 0 0 1 .9-.9z"
              fill={edge}
            />
            <path
              d="M3.1 7.4a.8.8 0 0 1 .75-.52H15.2a.55.55 0 0 1 .52.74l-1.5 4.32a.9.9 0 0 1-.85.61H1.9z"
              fill={body}
              stroke={edge}
              strokeWidth="0.4"
            />
          </>
        ) : (
          <path
            d="M1.5 4.4a.9.9 0 0 1 .9-.9h3.3l1.4 1.5H13.6a.9.9 0 0 1 .9.9v6a.9.9 0 0 1-.9.9H2.4a.9.9 0 0 1-.9-.9z"
            fill={body}
            stroke={edge}
            strokeWidth="0.5"
          />
        )}
      </svg>
    </span>
  );
}

/** The activity-bar folder button glyph (larger, monochrome). */
export function ExplorerIcon(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.2h7A1.5 1.5 0 0 1 19 8.7V17.5A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A small ✕ used to close the open file. */
export function CloseIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A disclosure chevron that points right (collapsed) or down (expanded). */
export function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <span
      className="tree-chevron"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}
      aria-hidden
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M3 2l4 3-4 3z" fill="currentColor" />
      </svg>
    </span>
  );
}
