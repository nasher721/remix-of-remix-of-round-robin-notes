import * as React from "react";
import { useEffect, useRef, useState } from "react";

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  delay: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, delay }) => {
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
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`group relative bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-border/40 hover:shadow-lg hover:border-primary/20 hover:-translate-y-1.5 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-5 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
        <span className="material-icons text-primary-foreground text-[28px]">{icon}</span>
      </div>
      <h3 className="text-xl font-bold text-foreground mb-3 font-heading tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground leading-relaxed text-[0.95rem]">
        {description}
      </p>
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
      <h2 className="text-[2.5rem] font-extrabold text-foreground tracking-tight mb-4 font-heading">
        {children}
      </h2>
      {sub && (
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
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
    title: "10-System Review",
    description: "Comprehensive organ-system documentation covering neuro, CV, respiratory, renal, GI, endo, heme, ID, skin/lines, and dispo.",
  },
  {
    icon: "smart_toy",
    title: "AI Clinical Assistant",
    description: "Intelligent text transformation, medication formatting, and clinical decision support powered by advanced AI models.",
  },
  {
    icon: "sync_alt",
    title: "Real-time Collaboration",
    description: "Seamless team-based rounding with live sync, change tracking, and field-level audit trails across all devices.",
  },
  {
    icon: "medication",
    title: "Medication Management",
    description: "Organize infusions, scheduled meds, and PRN medications with smart formatting and drug interaction checks.",
  },
  {
    icon: "print",
    title: "Flexible Export",
    description: "Export patient lists to PDF, Excel, or formatted documents. Customizable print layouts for handoffs and reports.",
  },
  {
    icon: "mic",
    title: "Voice Dictation",
    description: "Hands-free clinical documentation with real-time transcription and AI-powered text cleanup.",
  },
];

const stats = [
  { value: "10", label: "Body Systems", icon: "biotech" },
  { value: "24/7", label: "Cloud Access", icon: "cloud" },
  { value: "< 1s", label: "Sync Speed", icon: "bolt" },
  { value: "100%", label: "HIPAA Compliant", icon: "verified_user" },
];

const FeatureHighlights: React.FC = () => {
  return (
    <section className="relative py-24 px-6 bg-secondary/30 dark:bg-secondary/10">
      {/* Subtle top gradient */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-primary/5 to-transparent" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-24">
          {stats.map((stat, i) => (
            <StatCard key={i} {...stat} delay={i * 100} />
          ))}
        </div>

        {/* Features grid */}
        <SectionHeading sub="Everything your rounding team needs, built for the pace of critical care.">
          Powerful Features
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <FeatureCard key={i} {...feature} delay={i * 120} />
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <BottomCTA />
    </section>
  );
};

const StatCard: React.FC<{ value: string; label: string; icon: string; delay: number }> = ({
  value, label, icon, delay,
}) => {
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
      className={`text-center p-6 rounded-xl bg-card/70 dark:bg-card/50 backdrop-blur-sm border border-border/40 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="material-icons text-primary text-[32px] mb-2">{icon}</span>
      <div className="text-3xl font-extrabold text-foreground font-heading">
        {value}
      </div>
      <div className="text-sm text-muted-foreground mt-1 font-medium">
        {label}
      </div>
    </div>
  );
};

const BottomCTA: React.FC = () => {
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
      className={`max-w-3xl mx-auto mt-24 text-center transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-12 shadow-2xl shadow-primary/20 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <h3 className="text-3xl font-bold text-primary-foreground mb-4 font-heading tracking-tight">
            Ready to streamline your rounds?
          </h3>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-lg mx-auto">
            Join clinical teams already using Rolling Rounds for faster, smarter patient care.
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="bg-white/95 text-primary px-10 py-3.5 rounded-2xl text-base font-bold uppercase tracking-wider inline-flex items-center gap-2.5 shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-200 cursor-pointer border-none outline-none"
          >
            <span>Get Started</span>
            <span className="material-icons">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureHighlights;
