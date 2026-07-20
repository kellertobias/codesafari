/**
 * The running-tour panel — the right side of the shell. It shows the current
 * step (or detail sub-step) and navigation, and drives the shared file store so
 * the left code surface follows along. Steps may contain `@tour:detail`
 * sub-steps that zoom to a block within the step; they are flattened into the
 * Prev/Next sequence and shown nested in the overview.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Manifest } from '../../../src/model/types';
import { Markdown } from '../Markdown';
import { useFileStore } from '../fileStore';
import { href, navigate } from '../router';

/** A position in the flattened step/detail navigation sequence. */
interface Pos {
  stepIndex: number;
  /** null → the step itself; otherwise the index into step.details. */
  detailIndex: number | null;
}

// @tour viewer:3 The tour runner panel
// This is the panel you're reading in — the right side of the shell. Stepping
// calls the shared file store's `openRange`, which drives the code surface on
// the left. Detail sub-steps share the step's file, so moving to one scrolls
// within the same tab; moving to a step in another file opens/focuses its tab.
export function TourRunner({
  manifest,
  slug,
}: {
  manifest: Manifest;
  slug: string;
}): JSX.Element {
  const tour = manifest.tours.find((t) => t.slug === slug);
  const { activePath, openRange } = useFileStore();
  const steps = tour?.steps ?? [];

  // Flatten steps and their details into one navigable sequence.
  const flat = useMemo<Pos[]>(() => {
    const arr: Pos[] = [];
    steps.forEach((step, i) => {
      arr.push({ stepIndex: i, detailIndex: null });
      step.details.forEach((_, j) => arr.push({ stepIndex: i, detailIndex: j }));
    });
    return arr;
  }, [steps]);

  const [posIndex, setPosIndex] = usePosIndex(slug);
  const pos = flat[posIndex] ?? { stepIndex: 0, detailIndex: null };
  const currentStep = steps[pos.stepIndex];
  const currentDetail =
    currentStep && pos.detailIndex !== null
      ? currentStep.details[pos.detailIndex]
      : null;

  const goToPos = useCallback((n: number) => setPosIndex(n), [setPosIndex]);
  const flatIndexOf = useCallback(
    (stepIndex: number, detailIndex: number | null) =>
      flat.findIndex(
        (p) => p.stepIndex === stepIndex && p.detailIndex === detailIndex,
      ),
    [flat],
  );

  // Drive the left code surface to the current step/detail target. On a detail,
  // the parent step is passed as banded context so it stays in focus while the
  // rest of the file fades.
  useEffect(() => {
    if (!currentStep) return;
    if (currentDetail) {
      openRange(currentStep.file, currentDetail.highlight, currentStep.highlight);
    } else {
      openRange(currentStep.file, currentStep.highlight);
    }
  }, [currentStep, currentDetail, openRange]);

  // Keyboard navigation: left/right arrows move through the sequence.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && posIndex < flat.length - 1) {
        goToPos(posIndex + 1);
      } else if (e.key === 'ArrowLeft' && posIndex > 0) {
        goToPos(posIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [posIndex, flat.length, goToPos]);

  if (!tour) {
    return (
      <div className="page">
        <p className="empty">Unknown tour: {slug}</p>
        <a href={href('/')}>Back to overview</a>
      </div>
    );
  }

  const browsingAway =
    currentStep && activePath !== null && activePath !== currentStep.file;
  const calloutsForFile = activePath
    ? manifest.callouts.filter((c) => c.file === activePath)
    : [];

  return (
    <div className="tour-panel standalone">
      <div className="tour-panel-head">
        <a href={href(`/tour/${tour.slug}`)}>← {tour.title}</a>
      </div>

      <div className="tour-panel-body">
        {currentStep ? (
          <>
            {currentDetail && (
              <div className="detail-crumb">in {currentStep.title}</div>
            )}
            <h2 style={{ marginTop: 0 }}>
              {currentDetail ? currentDetail.title : currentStep.title}
            </h2>
            <Markdown source={currentDetail ? currentDetail.body : currentStep.body} />
          </>
        ) : (
          <p className="empty">This tour has no steps.</p>
        )}

        {browsingAway && currentStep && (
          <p className="empty" style={{ marginTop: 16 }}>
            Browsing <code>{activePath}</code> —{' '}
            <button
              className="link-button"
              onClick={() =>
                currentDetail
                  ? openRange(
                      currentStep.file,
                      currentDetail.highlight,
                      currentStep.highlight,
                    )
                  : openRange(currentStep.file, currentStep.highlight)
              }
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
          {steps.map((step, i) => {
            const stepActive =
              pos.stepIndex === i && pos.detailIndex === null && !browsingAway;
            return (
              <div key={`${step.file}:${step.order}`}>
                <button
                  className={`step-overview-item${stepActive ? ' active' : ''}`}
                  onClick={() => goToPos(flatIndexOf(i, null))}
                >
                  <span className="order">{step.order}</span>
                  {step.title}
                </button>
                {step.details.map((detail, j) => {
                  const detailActive =
                    pos.stepIndex === i && pos.detailIndex === j && !browsingAway;
                  return (
                    <button
                      key={j}
                      className={`step-overview-item detail${detailActive ? ' active' : ''}`}
                      onClick={() => goToPos(flatIndexOf(i, j))}
                    >
                      <span className="detail-dot">└</span>
                      {detail.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="tour-panel-nav">
        <button
          className="btn secondary"
          disabled={posIndex === 0}
          onClick={() => goToPos(posIndex - 1)}
        >
          ← Prev
        </button>
        <button
          className="btn"
          disabled={posIndex >= flat.length - 1}
          onClick={() => goToPos(posIndex + 1)}
        >
          Next →
        </button>
        {posIndex >= flat.length - 1 && flat.length > 0 && (
          <button className="btn secondary" onClick={() => navigate('/')}>
            Go to overview
          </button>
        )}
        <span className="spacer" style={{ flex: 1 }} />
        <span className="step-counter">
          {flat.length === 0 ? '0 / 0' : `${posIndex + 1} / ${flat.length}`}
        </span>
      </div>
    </div>
  );
}

/** Position index in the flattened sequence, reset when the tour slug changes. */
function usePosIndex(slug: string): [number, (n: number) => void] {
  const [state, setState] = useState<{ slug: string; index: number }>({
    slug,
    index: 0,
  });
  const index = state.slug === slug ? state.index : 0;
  const set = useCallback((n: number) => setState({ slug, index: n }), [slug]);
  return [index, set];
}
