import type { Metadata } from "next";
import { LegalPage } from "@/components/shell/legal-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="November 9, 2026">
      <p>By using SysLab you agree to these terms. If you don&apos;t agree, please don&apos;t use the service.</p>
      <h2>The service</h2>
      <p>SysLab lets you design system architectures and test them in a simulator. All numbers (latency, throughput, errors, cost) come from a deterministic model for learning. They are not measurements of real infrastructure and are not engineering or purchasing advice.</p>
      <h2>Your account</h2>
      <ul>
        <li>Keep your sign-in details secure; you&apos;re responsible for activity on your account.</li>
        <li>Don&apos;t create accounts to manipulate the leaderboard or impersonate others.</li>
      </ul>
      <h2>Your content</h2>
      <p>You own the designs you create. When you share a design, you allow anyone with the link to view it and copy it into their own workspace.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>No attempts to break, overload or gain unauthorised access to the service or other users&apos; data.</li>
        <li>No offensive or unlawful content in names or shared designs.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>
      <h2>No warranty</h2>
      <p>SysLab is provided &ldquo;as is&rdquo;, without warranties of any kind. We aren&apos;t liable for losses arising from its use, to the extent the law allows.</p>
      <h2>Changes</h2>
      <p>We may update these terms; the date above shows the latest version. Continuing to use SysLab after a change means you accept it.</p>
    </LegalPage>
  );
}
