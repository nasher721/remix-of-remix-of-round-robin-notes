import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CONTACT_EMAIL, CONTACT_EMAIL_IS_PLACEHOLDER } from "@/config/marketing";
import { animate, round, stagger } from "animejs";
import { durations, ease, staggers } from "@/lib/anime-presets";

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  variant: number;
  learnMoreId: string;
}

const variantStyles = [
  "bg-slate-50/90 dark:bg-slate-950/40 border-slate-200/80 shadow-slate-200/50",
  "bg-blue-50/90 dark:bg-blue-950/20 border-blue-200/60 shadow-blue-200/40",
  "bg-sky-50/90 dark:bg-sky-950/20 border-sky-200/60 shadow-sky-200/40",
  "bg-indigo-50/85 dark:bg-indigo-950/25 border-indigo-200/50 shadow-indigo-200/35",
  "bg-slate-50/90 dark:bg-slate-950/40 border-slate-200/80 shadow-slate-200/50",
  "bg-blue-50/90 dark:bg-blue-950/20 border-blue-200/60 shadow-blue-200/40",
];

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon, title, description, variant, learnMoreId,
}) => {
  const v = variant % variantStyles.length;

  return (
    <div
      className={`feature-card group relative backdrop-blur-sm rounded-2xl p-8 border shadow-md hover:shadow-xl hover:border-primary/25 hover:-translate-y-1.5 motion-reduce:hover:translate-y-0 transition-shadow transition-[border-color] duration-300 ${variantStyles[v]}`}
      style={{ opacity: 0, transform: "translateY(40px)" }}
    >
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-5 shadow-lg shadow-primary/20 group-hover:scale-110 motion-reduce:group-hover:scale-100 transition-transform duration-300 motion-reduce:transition-none">
        <span className="material-icons text-primary-foreground text-[28px]" aria-hidden>
          {icon}
        </span>
      </div>
      <h3 className="text-xl font-bold text-foreground mb-3 font-heading tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground leading-[1.5] text-[0.95rem] max-w-[65ch]">
        {description}
      </p>
      <a
        href={`#${learnMoreId}`}
        className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
      >
        Learn more
        <span className="material-icons text-base" aria-hidden>arrow_forward</span>
      </a>
    </div>
  );
};

const SectionHeading: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`text-center mb-16 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <h2 className="text-[2.5rem] font-extrabold text-foreground tracking-tight mb-4 font-heading text-balance max-w-[65ch] mx-auto leading-[1.2]">
        {children}
      </h2>
      {sub && (
        <p className="text-lg text-muted-foreground max-w-[65ch] mx-auto leading-[1.5]">
          {sub}
        </p>
      )}
      <div className="w-20 h-1 bg-gradient-to-r from-primary to-primary/50 mx-auto mt-6 rounded-full" />
    </div>
  );
};

const features = [
  {
    icon: "dashboard_customize",
    title: "10-system review",
    description: "Neuro, cardiovascular, respiratory, renal/GU, GI, endocrine, hematology, infectious disease, skin & lines, and disposition — structured for ICU-style handoffs.",
    learnMoreId: "security",
  },
  {
    icon: "smart_toy",
    title: "AI clinical assistant",
    description: "Text transformation, medication formatting, and decision-support style prompts — designed to speed documentation, not replace clinical judgment.",
    learnMoreId: "security",
  },
  {
    icon: "sync_alt",
    title: "Real-time collaboration",
    description: "Team-based rounding with sync, change tracking, and field-level history so everyone stays aligned on the same list.",
    learnMoreId: "security",
  },
  {
    icon: "medication",
    title: "Medication management",
    description: "Infusions, scheduled meds, and PRN buckets with formatting helpers to keep complex regimens readable at a glance.",
    learnMoreId: "features",
  },
  {
    icon: "print",
    title: "Flexible export",
    description: "Print and export paths for handoffs and reports — tune layouts to your team’s workflow.",
    learnMoreId: "features",
  },
  {
    icon: "mic",
    title: "Voice dictation",
    description: "Hands-free capture with transcription hooks where enabled — keep your eyes on the patient, not the keyboard.",
    learnMoreId: "features",
  },
];

const stats = [
  {
    value: "10",
    label: "Body systems",
    micro: "Neuro → dispo",
    icon: "biotech",
    accent: "from-emerald-500/15 to-teal-500/10 border-emerald-200/50",
  },
  {
    value: "24/7",
    label: "Cloud access",
    micro: "Secure browser session",
    icon: "cloud",
    accent: "from-sky-500/15 to-blue-500/10 border-sky-200/50",
  },
  {
    value: "< 1s",
    label: "Typical sync",
    micro: "When online",
    icon: "bolt",
    accent: "from-amber-500/15 to-orange-500/10 border-amber-200/50",
  },
  {
    value: "BAA",
    label: "When required",
    micro: "HIPAA is shared work",
    icon: "verified_user",
    accent: "from-violet-500/15 to-purple-500/10 border-violet-200/50",
  },
];

const FeatureGrid: React.FC<{ prefersReducedMotion: boolean }> = ({ prefersReducedMotion }) => {
  const gridRef = useRef<HTMLDivElement>(null)
  const animatedRef = useRef(false)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || animatedRef.current) return
        animatedRef.current = true
        observer.disconnect()

        const cards = grid.querySelectorAll<HTMLElement>('.feature-card')

        if (prefersReducedMotion) {
          cards.forEach(c => {
            c.style.opacity = '1'
            c.style.transform = 'translateY(0)'
          })
          return
        }

        animate(cards, {
          opacity: [0, 1],
          translateY: [40, 0],
          delay: stagger(staggers.cascade),
          duration: durations.slow,
          ease: ease.out,
        })
      },
      { threshold: 0.15 },
    )

    observer.observe(grid)
    return () => observer.disconnect()
  }, [prefersReducedMotion])

  return (
    <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {features.map((feature, i) => (
        <FeatureCard key={i} {...feature} variant={i} />
      ))}
    </div>
  )
}

interface FeatureHighlightsProps {
  prefersReducedMotion: boolean;
}

const FeatureHighlights: React.FC<FeatureHighlightsProps> = ({ prefersReducedMotion }) => {
  return (
    <>
      <section id="features" className="relative py-24 px-6 bg-secondary/30 dark:bg-secondary/10 scroll-mt-[72px]">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-primary/5 to-transparent" />

        <div className="max-w-6xl mx-auto relative z-10">
          <p className="text-center text-sm font-medium text-muted-foreground mb-10 max-w-xl mx-auto leading-[1.5]">
            Used by rounding teams who need a fast shared list — from academic ICUs to community hospitals.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-24">
            {stats.map((stat, i) => (
              <StatCard key={i} {...stat} delay={i * 100} prefersReducedMotion={prefersReducedMotion} />
            ))}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 sm:p-10 mb-20 overflow-hidden">
            <div className="flex flex-col lg:flex-row gap-8 items-center">
              <div className="flex-1 text-left space-y-3">
                <h3 className="text-xl font-bold font-heading text-foreground">See the workspace</h3>
                <p className="text-muted-foreground leading-[1.5] max-w-[65ch]">
                  Rolling Rounds centers on a sortable patient list, per-patient systems, meds, and tools for export — built for the pace of ward and ICU rounds.
                </p>
              </div>
              <div
                className="w-full lg:w-[min(100%,420px)] aspect-video rounded-xl border-2 border-border bg-gradient-to-br from-primary/10 via-primary/5 to-muted flex flex-col items-center justify-center gap-2 text-muted-foreground shadow-inner"
                role="img"
                aria-label="Product interface preview placeholder"
              >
                <span className="material-icons text-5xl text-primary/70" aria-hidden>dashboard</span>
                <span className="text-sm font-medium">Dashboard preview</span>
                <span className="text-xs text-center px-4">Screenshots vary by organization — sign in to see your data.</span>
              </div>
            </div>
          </div>

          <SectionHeading sub="Everything your rounding team needs, built for the pace of critical care.">
            Powerful features
          </SectionHeading>

          <FeatureGrid prefersReducedMotion={prefersReducedMotion} />
        </div>
      </section>

      <section id="pricing" className="py-20 px-6 bg-background border-y border-border/40 scroll-mt-[72px]">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground">Pricing</h2>
          <p className="text-muted-foreground leading-[1.5] max-w-[65ch] mx-auto">
            Rolling Rounds is built for clinical teams. Contact us for organization-wide rollout, training, or enterprise agreements — we’ll match how your hospital procures software.
          </p>
          <a
            href="#contact"
            className="inline-flex min-h-[44px] items-center justify-center px-6 py-2 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Talk to us
          </a>
        </div>
      </section>

      <section id="security" className="py-20 px-6 bg-secondary/20 scroll-mt-[72px]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground text-center mb-6">
            Security & HIPAA alignment
          </h2>
          <div className="max-w-none text-muted-foreground leading-[1.5] space-y-4">
            <p>
              We use industry-standard practices for authentication, encryption in transit (HTTPS), and access control backed by your identity provider where configured.
              Rolling Rounds is designed so PHI stays in your approved environment — review our{" "}
              <Link
                to="/privacy"
                className="text-primary font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                Privacy policy
              </Link>{" "}
              for how we handle account data.
            </p>
            <p>
              <strong className="text-foreground">Important:</strong> HIPAA compliance depends on your organization’s configuration, agreements (including a BAA where required), and how you use the product.
              We do not claim third-party certification on this marketing page — your compliance team should validate fit for your use case.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Role-based access via your auth provider</li>
              <li>Audit-friendly field history where enabled</li>
              <li>
                No selling of patient data — see{" "}
                <Link
                  to="/privacy"
                  className="text-primary font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  Privacy policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="contact" className="py-16 px-6 bg-background scroll-mt-[72px]">
        <div className="max-w-xl mx-auto text-center space-y-3">
          <h2 className="text-2xl font-extrabold font-heading">Contact</h2>
          <p className="text-muted-foreground leading-[1.5]">
            Questions about pilots, training, or security reviews?
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex min-h-[44px] items-center justify-center text-lg font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            {CONTACT_EMAIL}
          </a>
          {CONTACT_EMAIL_IS_PLACEHOLDER && (
            <p className="text-sm text-muted-foreground">Set <code className="text-xs bg-muted px-1 rounded">VITE_CONTACT_EMAIL</code> in production.</p>
          )}
        </div>
      </section>

      <BottomCTA prefersReducedMotion={prefersReducedMotion} />

      <LandingFooter />
    </>
  );
};

const StatCard: React.FC<{
  value: string;
  label: string;
  micro: string;
  icon: string;
  accent: string;
  delay: number;
  prefersReducedMotion: boolean;
}> = ({
  value, label, micro, icon, accent, delay, prefersReducedMotion,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const animatedRef = useRef(false);

  const numericTarget = /^\d+$/.test(value.trim()) ? parseInt(value.trim(), 10) : null;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || animatedRef.current || prefersReducedMotion) return;
    const el = valueRef.current;
    if (!el) return;
    animatedRef.current = true;

    if (numericTarget !== null) {
      el.textContent = "0";
      animate(el, {
        innerHTML: [0, numericTarget],
        modifier: round(0),
        duration: 1200,
        ease: "out(4)",
      });
    } else {
      animate(el, {
        opacity: [0, 1],
        scale: [0.85, 1],
        duration: durations.normal,
        ease: ease.spring,
      });
    }
  }, [isVisible, prefersReducedMotion, numericTarget]);

  return (
    <div
      ref={ref}
      className={`text-center p-5 sm:p-6 rounded-xl bg-gradient-to-br border-2 transition-all duration-500 motion-reduce:transition-opacity ${accent} ${
        isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95 motion-reduce:scale-100"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="material-icons text-primary text-[32px] mb-2 block" aria-hidden>
        {icon}
      </span>
      <div
        ref={valueRef}
        className="text-2xl sm:text-3xl font-extrabold text-foreground font-heading"
      >
        {numericTarget !== null && !prefersReducedMotion ? "" : value}
      </div>
      <div className="text-sm font-semibold text-foreground mt-1">
        {label}
      </div>
      <div className="text-xs text-muted-foreground mt-2 leading-[1.4]">
        {micro}
      </div>
    </div>
  );
};

const BottomCTA: React.FC<{ prefersReducedMotion: boolean }> = ({ prefersReducedMotion }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const goAuth = () => navigate("/auth");
  const goApp = () => {
    if (user) {
      navigate("/", { replace: true });
      window.location.reload();
    } else {
      navigate("/auth");
    }
  };

  return (
    <div
      ref={ref}
      className={`max-w-4xl mx-auto px-6 pb-8 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1976D2] p-10 sm:p-14 shadow-2xl text-center border border-white/10">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl pointer-events-none" aria-hidden />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-2xl pointer-events-none" aria-hidden />
        <div className="relative z-10">
          <p className="text-white/85 text-sm font-medium uppercase tracking-widest mb-3">Trusted for fast rounds</p>
          <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4 font-heading tracking-tight">
            Ready to streamline your rounds?
          </h3>
          <p className="text-white/90 text-lg mb-8 max-w-[65ch] mx-auto leading-[1.5]">
            <strong className="text-white">New team?</strong> Create an account to try the workspace.
            {" "}
            <strong className="text-white">Already using Rolling Rounds?</strong> Sign in to open your list.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <button
              type="button"
              onClick={goAuth}
              className="min-h-[44px] px-10 py-3.5 rounded-2xl bg-white text-[#0D47A1] text-base font-bold shadow-xl hover:bg-white/95 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1565C0]"
            >
              Create free account
            </button>
            <button
              type="button"
              onClick={goApp}
              className="min-h-[44px] px-10 py-3.5 rounded-2xl border-2 border-white/90 text-white font-semibold hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1565C0]"
            >
              {user ? "Open dashboard" : "Sign in — returning teams"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const reduced =
                prefersReducedMotion ||
                (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
              const behavior = reduced ? "auto" : "smooth";
              const heroTop = document.getElementById("top");
              if (heroTop) {
                heroTop.scrollIntoView({ behavior, block: "start" });
                return;
              }
              const landing = document.querySelector(".landing-page");
              if (landing instanceof HTMLElement) {
                landing.scrollTo({ top: 0, behavior });
                return;
              }
              window.scrollTo({ top: 0, behavior });
            }}
            className="mt-8 text-sm text-white/80 hover:text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-sm"
          >
            Back to top
          </button>
        </div>
      </div>
    </div>
  );
};

const LandingFooter: React.FC = () => {
  return (
    <footer className="border-t border-border bg-muted/30 py-12 px-6" role="contentinfo">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 text-sm">
        <div>
          <p className="font-bold font-heading text-foreground text-base mb-2">Rolling Rounds</p>
          <p className="text-muted-foreground leading-[1.5] max-w-xs">
            Clinical rounding lists, structured systems review, and team-friendly workflows — built for busy hospital teams.
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground mb-2">Legal</p>
          <ul className="space-y-2">
            <li>
              <Link
                to="/privacy"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                Privacy policy
              </Link>
            </li>
            <li>
              <a href="#security" className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
                Security & HIPAA
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground mb-2">Contact</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-10">
        © {new Date().getFullYear()} Rolling Rounds. All rights reserved.
      </p>
    </footer>
  );
};

export default FeatureHighlights;
