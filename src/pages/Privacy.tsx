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
        <h1 className="text-3xl font-extrabold font-heading">Deployment privacy notice required</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-[1.5] text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
          <strong>Development placeholder:</strong> This page is not an approved privacy notice. The deployment operator must replace it with counsel- and compliance-approved language that describes the actual deployment before production or use with sensitive data.
        </div>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Facts the operator must document</h2>
          <p>The approved notice should accurately identify:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>the operator, intended users, and contact responsible for the deployment;</li>
            <li>account, authentication, clinical, support, and usage data actually collected or processed;</li>
            <li>the purposes, legal basis, recipients, hosting locations, and access controls that actually apply;</li>
            <li>retention and deletion rules, including backup and account-closure behavior;</li>
            <li>available privacy rights and how a user may exercise them; and</li>
            <li>the effective date and process for notice changes.</li>
          </ul>
        </section>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Browser and device storage</h2>
          <p>
            The application may cache clinical content in browser storage for application and offline features. The approved deployment should define managed-device requirements, browser and operating-system protections, shared-device restrictions, sign-out procedures, and site-data clearing expectations.
          </p>
        </section>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">AI and dictation providers</h2>
          <p>
            When dictation is used, raw audio may be sent to OpenAI for transcription. If medical enhancement is enabled, the resulting transcript may then be sent to the selected AI provider. Other AI features may send included clinical text to that selected provider.
          </p>
          <p>
            Provider retention and data handling are governed by the selected provider&apos;s configuration and terms, plus the deployment operator&apos;s applicable agreement or BAA. The operator must approve each provider before sensitive data is submitted.
          </p>
        </section>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Health information and agreements</h2>
          <p>
            The software does not by itself establish HIPAA compliance. Do not enter protected health information unless the deployment operator has approved the configuration and workflow and has executed any required Business Associate Agreements (BAAs).
          </p>
        </section>
        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            For development-project questions, or until the deployment operator publishes its approved contact:{" "}
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
