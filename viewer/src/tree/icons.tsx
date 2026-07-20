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
  return (
    <span className="tree-icon" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {open ? (
          <path
            d="M1.5 4.5A1 1 0 0 1 2.5 3.5h3l1.2 1.4h5.3a1 1 0 0 1 1 1v.6H3.6a1 1 0 0 0-.96.73L1.5 12z"
            fill="#e2c08d"
          />
        ) : (
          <path
            d="M1.5 4A1 1 0 0 1 2.5 3h3.2l1.3 1.5h6.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1z"
            fill="#e2c08d"
          />
        )}
      </svg>
    </span>
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
