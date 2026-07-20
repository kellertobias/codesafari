/**
 * Extract `@tour` comment blocks from source text.
 *
 * A "comment block" is a run of consecutive comment lines with nothing but
 * comment markers and whitespace between them. Two block flavours are handled:
 *
 *   - Line comments (`//`, `#`) on consecutive lines form one block.
 *   - A single block comment (`/* ... *\/`) forms one block.
 *
 * The first line of a block may declare a tour step or a callout:
 *
 *   @tour <tour-slug>:<step-order> <Step title>
 *   @tour comment <Title>
 *
 * The remaining lines are the Markdown body. This module is language-agnostic
 * and regex-based; precise highlight-range resolution (class vs. function vs.
 * snippet) is layered on top by the target resolver.
 */

import { isValidOrderKey } from './ordering.js';

export interface RawTourComment {
  kind: 'step' | 'callout' | 'detail';
  /** For steps: the tour slug. Absent for callouts and details. */
  tourSlug?: string;
  /** For steps: the dot-aware order key. Absent for callouts and details. */
  order?: string;
  title: string;
  /** Markdown body assembled from the block's remaining lines. */
  body: string;
  /** 1-based line of the block's first line. */
  startLine: number;
  /** 1-based line of the block's last comment line. */
  endLine: number;
  /**
   * 1-based line of the first line of code AFTER the comment block, or null if
   * the block is at end of file. Used by the target resolver.
   */
  nextCodeLine: number | null;
}

interface CommentBlock {
  /** Comment content lines, markers stripped, in order. */
  lines: string[];
  startLine: number;
  endLine: number;
  nextCodeLine: number | null;
}

// Matches a header line: `@tour` followed by end-of-line, whitespace, or a
// colon (the `@tour:detail` form). The rest of the line is the payload.
const HEADER_RE = /^@tour(?=$|[\s:])(.*)$/;

/** Parse a header line's payload into a step/callout/detail descriptor, or null. */
function parseHeader(payload: string): Pick<
  RawTourComment,
  'kind' | 'tourSlug' | 'order' | 'title'
> | null {
  const trimmed = payload.trim();

  // `@tour:detail <title>` — a sub-step of the enclosing step.
  const detailMatch = /^:detail\b\s*(.*)$/.exec(trimmed);
  if (detailMatch) {
    return { kind: 'detail', title: detailMatch[1].trim() };
  }

  // `@tour comment <title>` — a non-navigable callout.
  const calloutMatch = /^comment\b\s*(.*)$/.exec(trimmed);
  if (calloutMatch) {
    return { kind: 'callout', title: calloutMatch[1].trim() };
  }

  // `@tour <tour-slug>:<order> <title>` — a navigable step.
  const stepMatch = /^([A-Za-z0-9._-]+):(\S+)\s*(.*)$/.exec(trimmed);
  if (stepMatch) {
    const [, tourSlug, order, title] = stepMatch;
    if (!isValidOrderKey(order)) return null;
    return { kind: 'step', tourSlug, order, title: title.trim() };
  }

  return null;
}

/** Turn a comment block into a tour comment if its first line is a header. */
function blockToComment(block: CommentBlock): RawTourComment | null {
  const firstNonEmpty = block.lines.findIndex((line) => line.trim().length > 0);
  if (firstNonEmpty === -1) return null;

  const headerMatch = HEADER_RE.exec(block.lines[firstNonEmpty].trim());
  if (!headerMatch) return null;

  const header = parseHeader(headerMatch[1]);
  if (!header) return null;

  const bodyLines = block.lines.slice(firstNonEmpty + 1);
  // Trim leading/trailing blank body lines but preserve internal structure.
  while (bodyLines.length > 0 && bodyLines[0].trim() === '') bodyLines.shift();
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
    bodyLines.pop();
  }

  return {
    ...header,
    body: dedent(bodyLines).join('\n'),
    startLine: block.startLine,
    endLine: block.endLine,
    nextCodeLine: block.nextCodeLine,
  };
}

/** Remove the common leading-whitespace indent shared by all non-empty lines. */
function dedent(lines: string[]): string[] {
  let min = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indent = line.length - line.trimStart().length;
    min = Math.min(min, indent);
  }
  if (!Number.isFinite(min) || min === 0) return lines;
  return lines.map((line) => (line.trim() === '' ? '' : line.slice(min)));
}

// @tour pipeline:3.2 Scanning @tour comments
// The other half of the inputs — extracted from the code itself. This groups
// runs of `//`, `#`, and `/* */` lines into blocks and keeps the ones whose
// first line is a `@tour` header, returning each as a step or a callout. This
// very comment is one of the blocks it would find.
/**
 * Scan source text and return every `@tour` comment it contains, in file order.
 */
export function scanComments(source: string): RawTourComment[] {
  const lines = source.split('\n');
  const blocks = collectBlocks(lines);
  const comments: RawTourComment[] = [];
  for (const block of blocks) {
    const comment = blockToComment(block);
    if (comment) comments.push(comment);
  }
  return comments;
}

/** Find the next non-blank, non-comment line at or after `from` (0-based). */
function nextCode(lines: string[], from: number): number | null {
  for (let i = from; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (isLineComment(trimmed)) continue;
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
      continue;
    }
    return i + 1; // 1-based
  }
  return null;
}

function isLineComment(trimmed: string): boolean {
  return trimmed.startsWith('//') || trimmed.startsWith('#');
}

function stripLineComment(trimmed: string): string {
  if (trimmed.startsWith('//')) return trimmed.slice(2).replace(/^ /, '');
  if (trimmed.startsWith('#')) return trimmed.slice(1).replace(/^ /, '');
  return trimmed;
}

/** Group source lines into comment blocks. */
function collectBlocks(lines: string[]): CommentBlock[] {
  const blocks: CommentBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Run of consecutive line comments.
    if (isLineComment(trimmed)) {
      const start = i;
      const content: string[] = [];
      while (i < lines.length && isLineComment(lines[i].trim())) {
        content.push(stripLineComment(lines[i].trim()));
        i++;
      }
      blocks.push({
        lines: content,
        startLine: start + 1,
        endLine: i,
        nextCodeLine: nextCode(lines, i),
      });
      continue;
    }

    // Block comment starting on this line.
    if (trimmed.startsWith('/*')) {
      const start = i;
      const content: string[] = [];
      let done = false;
      while (i < lines.length && !done) {
        let text = lines[i];
        if (i === start) text = text.slice(text.indexOf('/*') + 2);
        if (text.includes('*/')) {
          text = text.slice(0, text.indexOf('*/'));
          done = true;
        }
        content.push(stripBlockLine(text));
        i++;
      }
      blocks.push({
        lines: content,
        startLine: start + 1,
        endLine: i,
        nextCodeLine: nextCode(lines, i),
      });
      continue;
    }

    i++;
  }

  return blocks;
}

/** Strip a leading `*` gutter marker common in block comments. */
function stripBlockLine(text: string): string {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('*')) return trimmed.slice(1).replace(/^ /, '');
  return text.trim();
}
