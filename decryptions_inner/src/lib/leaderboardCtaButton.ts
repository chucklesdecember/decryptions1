/**
 * Shared Tailwind classes for Leaderboard navigation CTAs (puzzle screen, share modal).
 * Always use with <Button variant="black" /> so the default variant never applies
 * bg-primary / text-primary-foreground (which reads as a faint or off-brand CTA).
 */
export const LEADERBOARD_CTA_BUTTON_CLASSNAME =
  "border-2 border-gray-800 shadow-sm " +
  "hover:bg-gray-800 hover:text-white hover:shadow-md " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 " +
  "font-semibold text-base [&_svg]:text-white";
