import type { InterviewColorTag } from "./types";

export interface ColorTagMeta {
  label: string;
  /** Solid circle swatch, used by the picker. */
  dotClass: string;
  /** Pill badge shown next to the entrepreneur's name when this tag is set. */
  badgeClass: string;
  /** Top-border accent on the card itself, for scanning the whole list at a glance. Written as
   *  full static class names (not interpolated) so Tailwind's compiler picks them up. */
  borderClass: string;
}

export const COLOR_TAG_META: Record<InterviewColorTag, ColorTagMeta> = {
  gold: {
    label: "מידע בעל ערך רב",
    dotClass: "bg-amber-400",
    badgeClass: "bg-amber-100 text-amber-800",
    borderClass: "border-t-amber-400",
  },
  green: {
    label: "מידע התואם לתזה",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-800",
    borderClass: "border-t-emerald-500",
  },
  red: {
    label: "ראיון שלא מועיל יותר מדי",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-100 text-red-800",
    borderClass: "border-t-red-500",
  },
};
