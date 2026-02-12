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
      className={`group relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#e0e8f0] hover:shadow-[0_12px_40px_rgba(13,71,161,0.12)] hover:-translate-y-1 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1976D2] to-[#42A5F5] flex items-center justify-center mb-5 shadow-[0_4px_12px_rgba(25,118,210,0.3)] group-hover:scale-110 transition-transform duration-300">
        <span className="material-icons text-white text-[28px]">{icon}</span>
      </div>
      <h3 className="text-xl font-bold text-[#1a2332] mb-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        {title}
      </h3>
      <p className="text-[#5a6a7a] leading-relaxed text-[0.95rem]" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
      <h2
        className="text-[40px] font-extrabold text-[#1a2332] tracking-tight mb-4"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        {children}
      </h2>
      {sub && (
        <p className="text-lg text-[#5a6a7a] max-w-2xl mx-auto" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {sub}
        </p>
      )}
      <div className="w-20 h-1 bg-gradient-to-r from-[#1976D2] to-[#42A5F5] mx-auto mt-6 rounded-full" />
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
    <section className="relative py-24 px-6" style={{ backgroundColor: "#f4f8fc" }}>
      {/* Decorative top divider */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#42A5F5] to-transparent opacity-10" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-24">
          {stats.map((stat, i) => {
            const ref = React.createRef<HTMLDivElement>();
            return <StatCard key={i} {...stat} delay={i * 100} />;
          })}
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
      className={`text-center p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-[#e0e8f0] transition-all duration-600 ${
        isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="material-icons text-[#1976D2] text-[32px] mb-2">{icon}</span>
      <div className="text-3xl font-extrabold text-[#0D47A1]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        {value}
      </div>
      <div className="text-sm text-[#5a6a7a] mt-1 font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
      <div className="bg-gradient-to-br from-[#0D47A1] to-[#1976D2] rounded-3xl p-12 shadow-[0_20px_60px_rgba(13,71,161,0.25)]">
        <h3
          className="text-3xl font-bold text-white mb-4"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Ready to streamline your rounds?
        </h3>
        <p
          className="text-white/80 text-lg mb-8"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Join clinical teams already using Rolling Rounds for faster, smarter patient care.
        </p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="bg-white text-[#1976D2] px-10 py-3.5 rounded-full text-base font-bold uppercase tracking-wider inline-flex items-center gap-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:scale-105 transition-all cursor-pointer border-none outline-none"
        >
          <span>Get Started</span>
          <span className="material-icons">arrow_upward</span>
        </button>
      </div>
    </div>
  );
};

export default FeatureHighlights;
