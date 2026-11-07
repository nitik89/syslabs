import { Blocks, FlaskConical, LayoutDashboard, Target, TrendingUp, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: "/" | "/challenges" | "/build" | "/lab" | "/progress";
  label: string;
  description: string;
  icon: LucideIcon;
  section: "Practice" | "Workspace";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Overview and next steps", icon: LayoutDashboard, section: "Practice" },
  { href: "/challenges", label: "Challenges", description: "Fix broken architectures", icon: Target, section: "Practice" },
  { href: "/build", label: "Build", description: "Design real products", icon: Blocks, section: "Practice" },
  { href: "/lab", label: "Lab", description: "Free-form design canvas", icon: FlaskConical, section: "Workspace" },
  { href: "/progress", label: "Progress", description: "Scores, XP and streak", icon: TrendingUp, section: "Workspace" },
];

export function isActive(pathname: string, href: NavItem["href"]): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pages that are a full-bleed design canvas: the sidebar collapses to an icon rail there. */
export function isWorkspace(pathname: string): boolean {
  return pathname === "/lab" || /^\/(challenges|build)\/[^/]+$/.test(pathname);
}
