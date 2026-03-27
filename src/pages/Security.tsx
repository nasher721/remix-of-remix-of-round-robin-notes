import * as React from "react";
import { Link } from "react-router-dom";
import { CONTACT_EMAIL } from "@/config/marketing";

const Security: React.FC = () => {
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
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold font-heading mb-2">Security & Compliance</h1>
          <p className="text-muted-foreground text-sm leading-[1.5]">
            Last updated: March 27, 2026.
          </p>
        </div>

        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Data Handling</h2>
          <p>
            Patient data you enter is stored securely in our cloud database and synced across your devices in real time.
            We follow industry-standard practices for handling sensitive information, and access is restricted to authenticated users within your organization.
          </p>
          <p>
            Data is stored in the United States by default. If your organization requires data residency in a specific region, please contact us to discuss options.
          </p>
        </section>

        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Encryption</h2>
          <p>
            All data is encrypted both in transit and at rest. In transit, communications between your device and our servers are protected using TLS encryption.
            At rest, your data is encrypted using industry-standard encryption provided by our hosting infrastructure.
          </p>
          <p>
            Our authentication service uses secure, battle-tested protocols and does not store passwords in plain text.
          </p>
        </section>

        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Audit Trail</h2>
          <p>
            Changes to patient records are tracked with timestamps and user attribution, enabling organizations to maintain an audit trail of who changed what and when.
          </p>
          <p>
            The audit trail helps support compliance requirements and accountability within your care team. Contact your administrator for access to audit log data within your organization.
          </p>
        </section>

        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p>
            For security questions, vulnerability reports, or compliance inquiries:
          </p>
          <p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary font-medium hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-sm italic">
            We take security seriously and aim to respond to inquiries promptly.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Security;
