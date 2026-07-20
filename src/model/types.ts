/**
 * The renderer-neutral content model for a CodeSafari project.
 *
 * These types are the contract between the CLI (which parses `.tour/` content
 * and inline `@tour` comments) and the React viewer (which renders the
 * manifest). They are intentionally free of any Node or DOM dependency so the
 * same declarations can be shared by both sides.
 */

/** Semver-ish version stamped into every manifest for forward compatibility. */
export const MANIFEST_VERSION = 1 as const;

/** Project-level metadata and landing-page body, from `.tour/index.md`. */
export interface ProjectMeta {
  title: string;
  description: string;
  /** Fallback number of source lines to show when a step has no code block. */
  defaultSnippetLines: number;
  /** Optional link back to the project's repository. */
  repositoryUrl?: string;
  /** Markdown body of the landing page. */
  body: string;
}

/** A software component, from `.tour/components/*.md`. */
export interface Component {
  slug: string;
  title: string;
  summary?: string;
  order?: number;
  /** Markdown description. */
  body: string;
  /** Source path of the authoring file, relative to project root. */
  sourcePath: string;
}

/** A single navigable step within a tour, sourced from an inline comment. */
export interface TourStep {
  /** Tour this step belongs to. */
  tourSlug: string;
  /** Dot-aware order key, e.g. "12.34". Sorts numerically per dot segment. */
  order: string;
  title: string;
  /** Markdown body (the rest of the comment block). */
  body: string;
  /** File the anchoring comment lives in, relative to project root. */
  file: string;
  /** The code range the step highlights/scrolls to (1-based, inclusive). */
  highlight: LineRange;
  /** 1-based line of the comment's first line, for diagnostics. */
  commentLine: number;
  /**
   * How the highlight range was resolved — useful for diagnostics and viewer
   * affordances.
   */
  anchor: StepAnchorKind;
}

export type StepAnchorKind =
  | 'class'
  | 'function'
  | 'method'
  | 'block'
  | 'snippet';

export interface LineRange {
  /** 1-based, inclusive. */
  start: number;
  /** 1-based, inclusive. */
  end: number;
}

/** A non-navigable styled annotation, from `@tour comment <title>`. */
export interface SourceCallout {
  title: string;
  body: string;
  file: string;
  line: number;
}

/** A tour entry page, from `.tour/tours/**\/*.md`, plus its resolved steps. */
export interface Tour {
  slug: string;
  title: string;
  components: string[];
  order?: number;
  /** Overrides project `defaultSnippetLines` for this tour's steps. */
  defaultSnippetLines?: number;
  /** Markdown intro shown before "Start tour". */
  body: string;
  sourcePath: string;
  /** Steps sorted by dot-aware order. */
  steps: TourStep[];
}

/** A glossary concept, addressable via `glossary:<slug>` links. */
export interface GlossaryConcept {
  slug: string;
  title: string;
  /** Markdown body for this concept. */
  body: string;
  /** File the concept was defined in, relative to project root. */
  sourcePath: string;
}

/** A source file whose content is bundled for the viewer. */
export interface SourceFile {
  /** Path relative to project root. */
  path: string;
  language: string;
  content: string;
}

/** A rendered Mermaid diagram, keyed by a stable content hash. */
export interface DiagramAsset {
  id: string;
  /** Rendered SVG markup, or absent if rendering failed. */
  svg?: string;
  /** Present when rendering failed. */
  error?: string;
}

/**
 * v1.5: a small self-contained code walkthrough, from `.tour/examples`.
 * Included in the model now so the manifest shape is stable; population is a
 * v1.5 concern.
 */
export interface Example {
  slug: string;
  title: string;
  summary?: string;
  order?: number;
  language?: string;
  defaultStep?: number;
  tours: string[];
  components: string[];
  concepts: string[];
  sourcePath: string;
  steps: ExampleStep[];
}

export interface ExampleStep {
  order: number;
  title?: string;
  /** Complete, assembled code for this state. */
  code: string;
  /** Focused line ranges (1-based, inclusive). */
  focus: LineRange[];
}

/** A validation problem discovered while building the manifest. */
export interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  /** File the problem relates to, relative to project root, if known. */
  file?: string;
  /** 1-based line, if known. */
  line?: number;
}

/** The complete, frozen description of a CodeSafari project. */
export interface Manifest {
  version: typeof MANIFEST_VERSION;
  project: ProjectMeta;
  components: Component[];
  tours: Tour[];
  glossary: GlossaryConcept[];
  callouts: SourceCallout[];
  examples: Example[];
  /** Included source files, present in exported manifests. */
  files: SourceFile[];
  diagrams: DiagramAsset[];
}
