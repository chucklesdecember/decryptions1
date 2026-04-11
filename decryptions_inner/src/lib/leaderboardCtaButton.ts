/**
 * Shared Tailwind classes for Leaderboard navigation CTAs (puzzle screen, share modal).
 * Explicit dark surface + white text so contrast stays strong in light and `.dark` themes
 * (default `bg-primary` is nearly white in dark mode and caused white-on-white with `text-white`).
 */
export const LEADERBOARD_CTA_BUTTON_CLASSNAME =
  "bg-neutral-900 text-white border-2 border-neutral-950 shadow-md " +
  "hover:bg-neutral-800 hover:text-white " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 " +
  "font-semibold text-base [&_svg]:text-white " +
  "dark:bg-neutral-900 dark:text-white dark:border-neutral-950 dark:hover:bg-neutral-800";
