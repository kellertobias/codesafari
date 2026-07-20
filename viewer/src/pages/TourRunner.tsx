/**
 * The running-tour panel — the right-hand side of the shell. It shows the
 * current step's prose and navigation, and drives the shared file store so the
 * left code surface follows the step. "Sneak around" browsing (opening other
 * files from the tree or from Markdown references) happens in that shared
 * surface without disturbing this panel.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Manifest } from '../../../src/model/types';
import { Markdown } from '../Markdown';
import { useFileStore } from '../fileStore';
import { href } from '../router';

// @tour viewer:3 The tour runner panel
// This is the panel you're reading in — the right side of the shell. Stepping
// calls the shared file store's `openRange`, which drives the code surface on
// the left to the step's file and highlight. Opening any other file (from the
// tree or a Markdown reference) leaves this panel untouched.
export function TourRunner({
  manifest,
  slug,
}: {
  manifest: Manifest;
  slug: string;
}): JSX.Element {
  const tour = manifest.tours.find((t) => t.slug === slug);
  const { openPath, openRange } = useFileStore();

  const steps = tour?.steps ?? [];
  // The step index is derived from history via a piece of local state kept in
  // sync below; using the store for the file keeps the code pane authoritative.
  const [stepIndex, setStepIndex] = useStepIndex(slug);
  const currentStep = steps[stepIndex];

  const goToStep = useCallback(
    (index: number) => setStepIndex(index),
    [setStepIndex],
  );

  // Drive the left code surface whenever the current step changes.
  useEffect(() => {
    if (currentStep) openRange(currentStep.file, currentStep.highlight);
  }, [currentStep, openRange]);

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

  const browsingAway =
    currentStep && openPath !== null && openPath !== currentStep.file;
  const calloutsForFile = openPath
    ? manifest.callouts.filter((c) => c.file === openPath)
    : [];

  return (
    <div className="tour-panel standalone">
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

        {browsingAway && currentStep && (
          <p className="empty" style={{ marginTop: 16 }}>
            Browsing <code>{openPath}</code> —{' '}
            <button
              className="link-button"
              onClick={() => openRange(currentStep.file, currentStep.highlight)}
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
              className={`step-overview-item${i === stepIndex && !browsingAway ? ' active' : ''}`}
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
  );
}

/** Step index reset to 0 whenever the tour slug changes. */
function useStepIndex(slug: string): [number, (n: number) => void] {
  const [state, setState] = useState<{ slug: string; index: number }>({
    slug,
    index: 0,
  });
  const index = state.slug === slug ? state.index : 0;
  const set = useCallback(
    (n: number) => setState({ slug, index: n }),
    [slug],
  );
  return [index, set];
}
