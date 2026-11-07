import { Blocks, FlaskConical, LayoutDashboard, Target, TrendingUp, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: "/" | "/challenges" | "/build" | "/lab" | "/progress";
  label: string;
  description: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Overview and next steps", icon: LayoutDashboard },
  { href: "/challenges", label: "Challenges", description: "Fix broken architectures", icon: Target },
  { href: "/build", label: "Build", description: "Design real products", icon: Blocks },
  { href: "/lab", label: "Lab", description: "Free-form design canvas", icon: FlaskConical },
  { href: "/progress", label: "Progress", description: "Scores, XP and streak", icon: TrendingUp },
];

export function isActive(pathname: string, href: NavItem["href"]): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
