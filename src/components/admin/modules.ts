import type { IconName } from "@/components/ui/icon";

/**
 * Sections of the admin area. Each one here gets a link in the admin sidebar. When a planned
 * module is built, move it up with its href.
 */
export const adminModules: { label: string; href: string; icon: IconName }[] = [
  { label: "Profiles", href: "/admin/profiles", icon: "users" },
];

/** Shown in the sidebar under "Coming later", so the team can see what's planned. */
export const plannedModules: { label: string; icon: IconName }[] = [
  { label: "Events", icon: "calendar" },
  { label: "Library Intelligence", icon: "book" },
  { label: "Library Profiles", icon: "library" },
  { label: "Meeting Space Concierge", icon: "pin" },
];
