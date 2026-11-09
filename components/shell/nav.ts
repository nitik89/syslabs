import { Blocks, BookMarked, Crown, FlaskConical, GraduationCap, Layers, LayoutDashboard, Map, Target, TrendingUp, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: "/" | "/roadmap" | "/learn" | "/review" | "/challenges" | "/build" | "/lab" | "/cheat-sheet" | "/progress" | "/leaderboard";
  label: string;
  description: string;
  icon: LucideIcon;
  section: "Practice" | "Workspace";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Overview and next steps", icon: LayoutDashboard, section: "Practice" },
  { href: "/roadmap", label: "Roadmap", description: "The learning path, stage by stage", icon: Map, section: "Practice" },
  { href: "/learn", label: "Learn", description: "Design foundations, a few minutes each", icon: GraduationCap, section: "Practice" },
  { href: "/review", label: "Flashcards", description: "Spaced-repetition revision", icon: Layers, section: "Practice" },
  { href: "/challenges", label: "Challenges", description: "Fix broken architectures", icon: Target, section: "Practice" },
  { href: "/build", label: "Build", description: "Design real products", icon: Blocks, section: "Practice" },
  { href: "/lab", label: "Lab", description: "Free-form design canvas", icon: FlaskConical, section: "Workspace" },
  { href: "/cheat-sheet", label: "Cheat sheet", description: "Latency numbers and rules of thumb", icon: BookMarked, section: "Workspace" },
  { href: "/leaderboard", label: "Leaderboard", description: "Top learners by XP", icon: Crown, section: "Workspace" },
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
