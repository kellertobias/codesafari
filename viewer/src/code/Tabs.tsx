/** Editor tab strip for the open files. New tabs are appended to the right. */

import { FileIcon, CloseIcon } from '../tree/icons';
import { useFileStore } from '../fileStore';

/** Basename for the tab label. */
function baseName(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? path : path.slice(slash + 1);
}

export function Tabs(): JSX.Element | null {
  const { tabs, activePath, activateTab, closeTab } = useFileStore();
  if (tabs.length === 0) return null;

  return (
    <div className="tabs" role="tablist">
      {tabs.map((path) => (
        <div
          key={path}
          className={`tab${path === activePath ? ' active' : ''}`}
          role="tab"
          aria-selected={path === activePath}
          title={path}
          onClick={() => activateTab(path)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') activateTab(path);
          }}
          tabIndex={0}
        >
          <FileIcon name={baseName(path)} />
          <span className="tab-label">{baseName(path)}</span>
          <button
            className="tab-close"
            title="Close"
            aria-label={`Close ${baseName(path)}`}
            onClick={(e) => {
              e.stopPropagation();
              closeTab(path);
            }}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
