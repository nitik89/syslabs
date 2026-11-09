import type { Metadata } from "next";
import { LegalPage } from "@/components/shell/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="November 9, 2026">
      <p>SysLab is a system-design practice tool. This page explains what we store and why. We keep it short because we collect little.</p>
      <h2>Without an account</h2>
      <p>Everything (your progress, designs, drafts and flashcard reviews) is stored only in your browser&apos;s local storage. It never leaves your device, and clearing your browser data deletes it.</p>
      <h2>With an account</h2>
      <ul>
        <li>Your email address and, if you sign in with Google or GitHub, your name and avatar from that provider.</li>
        <li>Your progress, saved designs, drafts and flashcard reviews, so they follow you across devices.</li>
        <li>Designs you choose to share, as a read-only snapshot anyone with the link can view.</li>
      </ul>
      <p>Accounts and data are hosted by Supabase (database and authentication) and the site by Vercel. Row-level security means only you can read or change your private data.</p>
      <h2>What&apos;s public</h2>
      <p>If your profile is public (the default, changeable in Settings): your display name, username, avatar, XP, solved problems and active days appear on your profile page and the leaderboard. Your designs stay private unless you share one.</p>
      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data or show ads.</li>
        <li>We don&apos;t use third-party tracking cookies.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li>Make your profile private in Settings at any time.</li>
        <li>Export your data from the Progress page.</li>
        <li>Ask us to delete your account and all its data at any time.</li>
      </ul>
    </LegalPage>
  );
}
