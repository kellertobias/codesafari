/** Thin, typed wrapper over gray-matter for parsing frontmatter + body. */

import matter from 'gray-matter';

export interface ParsedDocument {
  data: Record<string, unknown>;
  body: string;
}

/** Parse a Markdown string into frontmatter data and trimmed body. */
export function parseFrontmatter(source: string): ParsedDocument {
  const parsed = matter(source);
  return { data: parsed.data as Record<string, unknown>, body: parsed.content.trim() };
}

/** Read a required string field, throwing a descriptive error if missing. */
export function requireString(
  data: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = data[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FieldError(`Missing required "${key}" in ${context}`);
  }
  return value;
}

export function optionalString(
  data: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

export function optionalNumber(
  data: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = data[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

export function optionalStringArray(
  data: Record<string, unknown>,
  key: string,
): string[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** A frontmatter validation error, carrying only a human-readable message. */
export class FieldError extends Error {}
