import type { IconName } from "@/components/ui/icon";

/**
 * Sections of the admin area. Each one here gets a link in the admin navigation and a card
 * on the admin home. When a planned module is built, move it up with its href and description.
 */
export const adminModules: { label: string; href: string; icon: IconName; description: string }[] = [
  {
    label: "Profiles",
    href: "/admin/profiles",
    icon: "users",
    description: "Pages about Valley organizations that help small businesses. Add, edit, publish and hide them.",
  },
];

/** Shown on the admin home as "Planned for later", so the team can see what's coming. */
export const plannedModules: { label: string; icon: IconName }[] = [
  { label: "Events", icon: "calendar" },
  { label: "Library Intelligence", icon: "book" },
  { label: "Library Profiles", icon: "library" },
  { label: "Meeting Space Concierge", icon: "pin" },
];
