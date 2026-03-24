import * as React from "react";
import { Link } from "react-router-dom";
import { CONTACT_EMAIL } from "@/config/marketing";

const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link
            to="/"
            className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            ← Back to home
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-extrabold font-heading">Privacy policy</h1>
        <p className="text-muted-foreground text-sm leading-[1.5]">
          Last updated: March 22, 2026. This is a lightweight placeholder suitable for development and internal review — replace with counsel-approved text before production.
        </p>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
          <p>
            Account identifiers (such as email), authentication events, and product usage needed to operate the service may be processed by our hosting and authentication providers.
            Patient-related content you enter is stored according to your organization’s configuration and applicable agreements.
          </p>
        </section>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">How we use data</h2>
          <p>
            We use account data to provide sign-in, sync, support, and security monitoring. We do not sell patient data.
            AI or transcription features, where enabled, should be reviewed against your institution’s policies.
          </p>
        </section>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">HIPAA & BAAs</h2>
          <p>
            HIPAA compliance is a shared responsibility. A Business Associate Agreement (BAA) may be required before using the product with PHI — coordinate with your compliance and legal teams.
          </p>
        </section>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            For privacy questions:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </main>
    </div>
  );
};

export default Privacy;
