// Shared class recipes so every page uses the same buttons, inputs and cards.
// Plain strings (not components) to keep markup readable and server-component friendly.

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btn = {
  /** The one main action in a region. */
  primary: `${btnBase} bg-accent px-4 py-2 text-accent-ink hover:bg-accent-hover`,
  /** Secondary actions: outlined, quiet. */
  secondary: `${btnBase} border border-line-strong bg-surface-2 px-3 py-1.5 text-ink hover:border-ink-3 hover:bg-surface-3`,
  /** Tertiary / inline actions. */
  ghost: `${btnBase} px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink`,
  /** Destructive secondary action. */
  danger: `${btnBase} border border-danger-line px-3 py-1.5 text-danger hover:bg-danger-soft`,
};

export const card = "rounded-xl border border-line bg-surface";

export function input(invalid = false) {
  return `w-full rounded-lg border bg-surface-2 px-3 py-2 text-base text-ink placeholder:text-ink-3 outline-none transition-colors focus:ring-2 ${
    invalid ? "border-danger-line focus:ring-danger/25" : "border-line-strong hover:border-ink-3 focus:border-accent focus:ring-accent/25"
  }`;
}

export const select = `${input()} pr-8`;

export const label = "mb-1.5 block text-sm font-medium text-ink-2";

export const badge = {
  neutral: "rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2",
  accent: "rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent",
  warn: "rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn",
  violet: "rounded-full bg-violet-soft px-2 py-0.5 text-xs font-medium text-violet",
};

export const pageTitle = "text-2xl font-semibold tracking-tight text-ink";
export const pageSubtitle = "mt-1 text-sm text-ink-2";
