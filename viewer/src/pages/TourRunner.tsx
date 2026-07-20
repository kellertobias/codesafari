/**
 * The running-tour layout: file tree (left), read-only code viewer (center),
 * and the tour panel (right). Supports "sneak around" — any file can be opened
 * from the tree and scrolled freely — while step selection drives the code
 * viewer to the referenced file and range.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LineRange, Manifest, SourceFile } from '../../../src/model/types';
import { CodeViewer } from '../code/CodeViewer';
import { FileTree } from '../FileTree';
import { Markdown } from '../Markdown';
import { href, navigate } from '../router';

interface OpenTarget {
  path: string;
  highlight: LineRange | null;
}

// @tour viewer:3 The three-pane runner
// This is the screen you're reading in. Left: the file tree over every bundled
// source file. Center: the read-only code pane. Right: this step panel. The
// `open` state powers "sneak around" — opening a file from the tree detaches the
// pane from the current step until you pick a step again.
export function TourRunner({
  manifest,
  slug,
}: {
  manifest: Manifest;
  slug: string;
}): JSX.Element {
  const tour = manifest.tours.find((t) => t.slug === slug);
  const [stepIndex, setStepIndex] = useState(0);
  const [open, setOpen] = useState<OpenTarget | null>(null);

  const fileByPath = useMemo(() => {
    const map = new Map<string, SourceFile>();
    for (const file of manifest.files) map.set(file.path, file);
    return map;
  }, [manifest.files]);

  const steps = tour?.steps ?? [];
  const currentStep = steps[stepIndex];

  // Follow the current step unless the user has manually opened another file.
  const activeTarget: OpenTarget | null =
    open ??
    (currentStep
      ? { path: currentStep.file, highlight: currentStep.highlight }
      : null);

  const goToStep = useCallback(
    (index: number) => {
      setStepIndex(index);
      setOpen(null); // Re-attach the viewer to the step's file/range.
    },
    [],
  );

  // Keyboard navigation: left/right arrows move between steps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && stepIndex < steps.length - 1) {
        goToStep(stepIndex + 1);
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        goToStep(stepIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIndex, steps.length, goToStep]);

  if (!tour) {
    return (
      <div className="page">
        <p className="empty">Unknown tour: {slug}</p>
        <a href={href('/')}>Back to overview</a>
      </div>
    );
  }

  const activeFile = activeTarget ? fileByPath.get(activeTarget.path) : undefined;

  const calloutsForFile = activeTarget
    ? manifest.callouts.filter((c) => c.file === activeTarget.path)
    : [];

  return (
    <div className="runner">
      <div className="pane tree">
        <FileTree
          files={manifest.files}
          activePath={activeTarget?.path ?? null}
          onSelect={(path) => setOpen({ path, highlight: null })}
        />
      </div>

      <div className="pane code">
        {activeFile ? (
          <CodeViewer
            content={activeFile.content}
            language={activeFile.language}
            highlight={activeTarget?.highlight ?? null}
            path={activeFile.path}
          />
        ) : (
          <div className="empty" style={{ padding: 20 }}>
            {activeTarget
              ? `Source not bundled: ${activeTarget.path}`
              : 'Select a step to begin.'}
          </div>
        )}
      </div>

      <div className="pane tour">
        <div className="tour-panel-head">
          <a href={href(`/tour/${tour.slug}`)}>← {tour.title}</a>
        </div>

        <div className="tour-panel-body">
          {currentStep ? (
            <>
              <h2 style={{ marginTop: 0 }}>{currentStep.title}</h2>
              <Markdown source={currentStep.body} />
            </>
          ) : (
            <p className="empty">This tour has no steps.</p>
          )}

          {open && currentStep && open.path !== currentStep.file && (
            <p className="empty" style={{ marginTop: 16 }}>
              Browsing <code>{open.path}</code> —{' '}
              <button
                className="tree-item"
                style={{ display: 'inline', padding: 0, width: 'auto' }}
                onClick={() => setOpen(null)}
              >
                return to step
              </button>
            </p>
          )}

          {calloutsForFile.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {calloutsForFile.map((callout, i) => (
                <div className="callout" key={i}>
                  <div className="callout-title">{callout.title}</div>
                  <Markdown source={callout.body} />
                </div>
              ))}
            </div>
          )}

          <div className="step-overview">
            {steps.map((step, i) => (
              <button
                key={`${step.file}:${step.order}`}
                className={`step-overview-item${i === stepIndex && !open ? ' active' : ''}`}
                onClick={() => goToStep(i)}
              >
                <span className="order">{step.order}</span>
                {step.title}
              </button>
            ))}
          </div>
        </div>

        <div className="tour-panel-nav">
          <button
            className="btn secondary"
            disabled={stepIndex === 0}
            onClick={() => goToStep(stepIndex - 1)}
          >
            ← Prev
          </button>
          <button
            className="btn"
            disabled={stepIndex >= steps.length - 1}
            onClick={() => goToStep(stepIndex + 1)}
          >
            Next →
          </button>
          <span className="spacer" style={{ flex: 1 }} />
          <span className="step-counter">
            {steps.length === 0 ? '0 / 0' : `${stepIndex + 1} / ${steps.length}`}
          </span>
        </div>
      </div>
    </div>
  );
}
