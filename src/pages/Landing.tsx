import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, ClipboardList, LockKeyhole, RefreshCw, ShieldCheck, Smartphone, Users, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import FeatureHighlights from "@/components/landing/FeatureHighlights";
import { useMotionPreference } from "@/hooks/useReducedMotion";
import rollingRoundsLogo from "@/assets/rolling-rounds-logo.png";

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefersReducedMotion } = useMotionPreference();

  const handleLaunchPortal = () => {
    if (user) {
      navigate("/", { replace: true });
      window.location.reload();
      return;
    }
    navigate("/auth");
  };

  const handleGetStarted = () => {
    navigate("/auth");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  };

  const trustPoints: Array<[string, LucideIcon]> = [
    ["Mobile ready", Smartphone],
    ["Team sync", RefreshCw],
    ["Access controls", LockKeyhole],
  ];

  return (
    <div className="landing-page min-h-[100dvh] bg-[#f7f9fb] text-slate-950">
      <header className="sticky top-0 z-[90] border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
            }}
          >
            <img src={rollingRoundsLogo} alt="" className="h-7 w-auto" aria-hidden="true" />
            <span className="truncate text-sm font-semibold tracking-tight text-slate-950">Rolling Rounds</span>
          </a>

          <nav className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex" aria-label="Primary">
            {[
              ["Features", "features"],
              ["Security", "security"],
              ["Pricing", "pricing"],
              ["Contact", "contact"],
            ].map(([label, id]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={handleGetStarted}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main-content">
        <section id="top" className="border-b border-slate-200/80">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Built for clinical rounding teams
              </div>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                A cleaner command center for rounds.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                Manage patient lists, notes, tasks, and team handoffs in one focused workspace.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleGetStarted}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label="Create an account or sign in to get started"
                >
                  Start workspace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleLaunchPortal}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={user ? "Open your workspace dashboard" : "Sign in for returning teams"}
                >
                  {user ? "Open dashboard" : "Returning team"}
                </button>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-3">
                {trustPoints.map(([label, Icon]) => (
                  <div key={label} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-xl border border-slate-200 bg-white shadow-[0_18px_50px_rgb(15_23_42_/_0.08)]">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Today's list</p>
                      <p className="text-xs text-slate-500">4 active patients</p>
                    </div>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    Synced
                  </div>
                </div>
                <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
                  <div className="border-b border-slate-200 p-3 lg:border-b-0 lg:border-r">
                    {[
                      ["A. Chen", "7W-12", "2 tasks"],
                      ["M. Patel", "7W-14", "Ready"],
                      ["J. Rivera", "ICU-03", "Review labs"],
                    ].map(([name, bed, status], index) => (
                      <div
                        key={name}
                        className={`mb-2 rounded-lg border p-3 text-sm ${
                          index === 0 ? "border-primary/30 bg-primary/5" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-950">{name}</span>
                          <span className="font-mono text-xs text-slate-500">{bed}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{status}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Interval events</p>
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                        Overnight oxygen weaned. Net negative 800 mL. Family updated after rounds.
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["Systems", "Focused ICU-style review"],
                        ["Tasks", "Follow-ups linked to patient"],
                        ["Export", "Print handoff-ready notes"],
                        ["AI tools", "Drafting support with guardrails"],
                      ].map(([title, body]) => (
                        <div key={title} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-950">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        Team view
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        Audit-aware
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FeatureHighlights prefersReducedMotion={prefersReducedMotion} />
      </main>
    </div>
  );
};

export default Landing;
