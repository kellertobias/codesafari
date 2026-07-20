/**
 * The running-tour panel — the right side of the shell. It shows the current
 * step (or detail sub-step) and navigation, and drives the shared file store so
 * the left code surface follows along. Steps may contain `@tour:detail`
 * sub-steps that zoom to a block within the step; they are flattened into the
 * Prev/Next sequence and shown nested in the overview.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Manifest,
  SourceCallout,
  StepDetail,
  TourStep,
} from '../../../src/model/types';
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

  const flat = useFlatSequence(steps);
  const [posIndex, setPosIndex] = usePosIndex(slug);
  const pos = flat[posIndex] ?? { stepIndex: 0, detailIndex: null };
  const currentStep = steps[pos.stepIndex];
  const currentDetail =
    currentStep && pos.detailIndex !== null
      ? currentStep.details[pos.detailIndex]
      : null;

  const flatIndexOf = useCallback(
    (stepIndex: number, detailIndex: number | null) =>
      flat.findIndex(
        (p) => p.stepIndex === stepIndex && p.detailIndex === detailIndex,
      ),
    [flat],
  );

  // Point the left code surface at the current step/detail. On a detail the
  // parent step is passed as banded context so it stays in focus while the rest
  // of the file fades. Shared by the navigation effect and "return to step".
  const focusCurrent = useCallback(() => {
    if (!currentStep) return;
    openRange(
      currentStep.file,
      currentDetail ? currentDetail.highlight : currentStep.highlight,
      currentDetail ? currentStep.highlight : null,
    );
  }, [currentStep, currentDetail, openRange]);

  useEffect(focusCurrent, [focusCurrent]);
  useArrowKeyNav(posIndex, flat.length, setPosIndex);

  if (!tour) {
    return (
      <div className="page">
        <p className="empty">Unknown tour: {slug}</p>
        <a href={href('/')}>Back to overview</a>
      </div>
    );
  }

  const browsingAway =
    !!currentStep && activePath !== null && activePath !== currentStep.file;
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
          <StepBody step={currentStep} detail={currentDetail} />
        ) : (
          <p className="empty">This tour has no steps.</p>
        )}

        {browsingAway && (
          <BrowsingAwayNotice path={activePath!} onReturn={focusCurrent} />
        )}

        <FileCallouts callouts={calloutsForFile} />

        <StepOverview
          steps={steps}
          pos={pos}
          browsingAway={browsingAway}
          onSelect={(s, d) => setPosIndex(flatIndexOf(s, d))}
        />
      </div>

      <TourNav
        posIndex={posIndex}
        total={flat.length}
        onGo={setPosIndex}
        onOverview={() => navigate('/')}
      />
    </div>
  );
}

/** The active step or detail: breadcrumb, title, and Markdown body. */
function StepBody({
  step,
  detail,
}: {
  step: TourStep;
  detail: StepDetail | null;
}): JSX.Element {
  return (
    <>
      {detail && <div className="detail-crumb">in {step.title}</div>}
      <h2 style={{ marginTop: 0 }}>{detail ? detail.title : step.title}</h2>
      <Markdown source={detail ? detail.body : step.body} />
    </>
  );
}

/** Shown when the user has browsed to a file other than the current step's. */
function BrowsingAwayNotice({
  path,
  onReturn,
}: {
  path: string;
  onReturn: () => void;
}): JSX.Element {
  return (
    <p className="empty" style={{ marginTop: 16 }}>
      Browsing <code>{path}</code> —{' '}
      <button className="link-button" onClick={onReturn}>
        return to step
      </button>
    </p>
  );
}

/** Non-navigable `@tour comment` callouts anchored in the open file. */
function FileCallouts({ callouts }: { callouts: SourceCallout[] }): JSX.Element | null {
  if (callouts.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      {callouts.map((callout, i) => (
        <div className="callout" key={i}>
          <div className="callout-title">{callout.title}</div>
          <Markdown source={callout.body} />
        </div>
      ))}
    </div>
  );
}

/** The full step list with nested details; the current position is highlighted. */
function StepOverview({
  steps,
  pos,
  browsingAway,
  onSelect,
}: {
  steps: TourStep[];
  pos: Pos;
  browsingAway: boolean;
  onSelect: (stepIndex: number, detailIndex: number | null) => void;
}): JSX.Element {
  const isActive = (stepIndex: number, detailIndex: number | null) =>
    pos.stepIndex === stepIndex && pos.detailIndex === detailIndex && !browsingAway;

  return (
    <div className="step-overview">
      {steps.map((step, i) => (
        <div key={`${step.file}:${step.order}`}>
          <button
            className={`step-overview-item${isActive(i, null) ? ' active' : ''}`}
            onClick={() => onSelect(i, null)}
          >
            <span className="order">{step.order}</span>
            {step.title}
          </button>
          {step.details.map((detail, j) => (
            <button
              key={j}
              className={`step-overview-item detail${isActive(i, j) ? ' active' : ''}`}
              onClick={() => onSelect(i, j)}
            >
              <span className="detail-dot">└</span>
              {detail.title}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Prev/Next footer, plus an "overview" shortcut on the final position. */
function TourNav({
  posIndex,
  total,
  onGo,
  onOverview,
}: {
  posIndex: number;
  total: number;
  onGo: (n: number) => void;
  onOverview: () => void;
}): JSX.Element {
  const atEnd = posIndex >= total - 1;
  return (
    <div className="tour-panel-nav">
      <button className="btn secondary" disabled={posIndex === 0} onClick={() => onGo(posIndex - 1)}>
        ← Prev
      </button>
      <button className="btn" disabled={atEnd} onClick={() => onGo(posIndex + 1)}>
        Next →
      </button>
      {atEnd && total > 0 && (
        <button className="btn secondary" onClick={onOverview}>
          Go to overview
        </button>
      )}
      <span className="spacer" style={{ flex: 1 }} />
      <span className="step-counter">
        {total === 0 ? '0 / 0' : `${posIndex + 1} / ${total}`}
      </span>
    </div>
  );
}

/** Flatten steps and their details into one navigable Prev/Next sequence. */
function useFlatSequence(steps: TourStep[]): Pos[] {
  return useMemo<Pos[]>(() => {
    const seq: Pos[] = [];
    steps.forEach((step, i) => {
      seq.push({ stepIndex: i, detailIndex: null });
      step.details.forEach((_, j) => seq.push({ stepIndex: i, detailIndex: j }));
    });
    return seq;
  }, [steps]);
}

/** Bind left/right arrow keys to move through the flattened sequence. */
function useArrowKeyNav(
  posIndex: number,
  length: number,
  goTo: (n: number) => void,
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && posIndex < length - 1) goTo(posIndex + 1);
      else if (e.key === 'ArrowLeft' && posIndex > 0) goTo(posIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [posIndex, length, goTo]);
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
