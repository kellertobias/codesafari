/**
 * Resolve the highlight range for a tour step from its anchoring comment.
 *
 * The spec calls for Tree-sitter (TS/TSX, Rust, Python) to identify the class,
 * function, method, or block that directly follows a step comment. This module
 * implements a pragmatic, dependency-free heuristic that covers the common
 * cases for those languages today; it is deliberately isolated behind
 * {@link resolveTarget} so a Tree-sitter backend can replace it without
 * touching callers.
 *
 * Resolution rules (matching the spec):
 *   - Comment directly before a class      -> the whole class.
 *   - Comment directly before a fn/method  -> that function/method.
 *   - Comment directly before another block-> that block.
 *   - Otherwise                            -> the comment plus the next
 *                                             `defaultSnippetLines` lines.
 */

import type { LineRange, StepAnchorKind } from '../model/types.js';

export type Language = 'typescript' | 'tsx' | 'rust' | 'python' | 'unknown';

export interface ResolvedTarget {
  highlight: LineRange;
  anchor: StepAnchorKind;
}

const CLASS_RE = /\b(class|interface|enum|struct|trait|impl)\b/;
const FUNCTION_RE =
  /\b(function|fn|def|const|let|var)\b|=>|\basync\b|\bpublic\b|\bprivate\b|\bprotected\b/;

/**
 * @param lines       Source split into lines (no trailing newline entries).
 * @param nextCodeLine 1-based line of the first code line after the comment, or
 *                     null if the comment is at EOF.
 * @param commentStart 1-based line of the comment block's first line.
 * @param snippetLines Fallback line count when no block is detected.
 * @param language     Language hint for indentation vs. brace matching.
 */
export function resolveTarget(
  lines: string[],
  nextCodeLine: number | null,
  commentStart: number,
  snippetLines: number,
  language: Language,
): ResolvedTarget {
  if (nextCodeLine === null) {
    // Comment at end of file: fall back to a snippet around the comment.
    return snippetFallback(lines, commentStart, snippetLines);
  }

  const idx = nextCodeLine - 1; // 0-based
  const firstLine = lines[idx] ?? '';
  const anchor = classifyAnchor(firstLine);

  if (anchor === 'snippet') {
    return snippetFallback(lines, commentStart, snippetLines);
  }

  const end =
    language === 'python'
      ? blockEndByIndent(lines, idx)
      : blockEndByBraces(lines, idx);

  return {
    highlight: { start: nextCodeLine, end },
    anchor,
  };
}

function classifyAnchor(line: string): StepAnchorKind {
  const trimmed = line.trim();
  if (CLASS_RE.test(trimmed)) return 'class';
  if (/\bdef\b|\bfn\b|\bfunction\b/.test(trimmed)) {
    // A `def`/`fn`/`function` at statement position is a function or method;
    // callers don't distinguish the two structurally, so report "function".
    return 'function';
  }
  if (FUNCTION_RE.test(trimmed) && /\(/.test(trimmed)) return 'function';
  if (/[:{]\s*$/.test(trimmed) || /\b(if|for|while|match|switch)\b/.test(trimmed)) {
    return 'block';
  }
  return 'snippet';
}

/** Find the end of a brace-delimited block (C-like languages), 1-based. */
function blockEndByBraces(lines: string[], startIdx: number): number {
  // Scan forward to the first '{'; if none appears soon, treat as single line.
  let depth = 0;
  let sawBrace = false;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth++;
        sawBrace = true;
      } else if (ch === '}') {
        depth--;
        if (sawBrace && depth === 0) return i + 1;
      }
    }
    // A statement ending in ';' before any brace is a single-line construct.
    if (!sawBrace && lines[i].trimEnd().endsWith(';')) return i + 1;
    // Guard against runaway scans on malformed input.
    if (i - startIdx > 2000) break;
  }
  return Math.min(lines.length, startIdx + 1);
}

/** Find the end of an indentation-delimited block (Python), 1-based. */
function blockEndByIndent(lines: string[], startIdx: number): number {
  const headerIndent = indentOf(lines[startIdx]);
  let end = startIdx; // at least the header line
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      continue; // blank lines don't end a block
    }
    if (indentOf(lines[i]) <= headerIndent) break;
    end = i;
  }
  return end + 1;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function snippetFallback(
  lines: string[],
  commentStart: number,
  snippetLines: number,
): ResolvedTarget {
  const start = commentStart;
  const end = Math.min(lines.length, commentStart + Math.max(1, snippetLines));
  return { highlight: { start, end }, anchor: 'snippet' };
}

/** Map a file extension to a parser language hint. */
export function languageForPath(path: string): Language {
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.ts') || path.endsWith('.mts') || path.endsWith('.cts')) {
    return 'typescript';
  }
  if (path.endsWith('.rs')) return 'rust';
  if (path.endsWith('.py')) return 'python';
  return 'unknown';
}
