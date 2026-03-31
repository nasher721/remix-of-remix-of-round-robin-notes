import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { stagger } from "animejs";
import { useAuth } from "@/hooks/useAuth";
import FeatureHighlights from "@/components/landing/FeatureHighlights";
import { useAnimeTimeline } from "@/hooks/useAnimeTimeline";
import { useMotionPreference } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefersReducedMotion } = useMotionPreference();
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRootRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollY(containerRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleLaunchPortal = () => {
    if (user) {
      navigate("/", { replace: true });
      window.location.reload();
    } else {
      navigate("/auth");
    }
  };

  const handleGetStarted = () => {
    navigate("/auth");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    }
  };

  const parallaxSlow = scrollY * 0.3;
  const parallaxMed = scrollY * 0.5;
  const parallaxFast = scrollY * 0.7;
  const bgOpacity = Math.min(scrollY / 600, 0.15);

  useAnimeTimeline({
    rootRef: heroRootRef,
    enabled: true,
    prefersReducedMotion,
    setup: ({ timeline, root }) => {
      const title = root.querySelector("[data-anime-hero-title]");
      const subtitle = root.querySelector("[data-anime-hero-subtitle]");
      const chips = root.querySelectorAll("[data-anime-hero-chip]");
      const cta = root.querySelector("[data-anime-hero-cta]");
      if (!title || !subtitle || chips.length === 0 || !cta) {
        return;
      }
      timeline.add(title, { opacity: [0, 1], y: [24, 0], duration: 650, ease: "outCubic" }, 0);
      timeline.add(subtitle, { opacity: [0, 1], y: [20, 0], duration: 600, ease: "outCubic" }, "+=120");
      timeline.add(chips, { opacity: [0, 1], y: [16, 0], duration: 500, ease: "outCubic" }, stagger(80));
      timeline.add(cta, { opacity: [0, 1], y: [16, 0], duration: 550, ease: "outCubic" }, "+=100");
    },
    deps: [],
  });

  return (
    <div
      ref={containerRef}
      className="landing-page min-h-screen relative overflow-y-auto overflow-x-hidden transition-colors duration-[1500ms] ease-in-out scroll-smooth"
      style={{ backgroundColor: "#eef4f9" }}
    >
      <header className="sticky top-0 z-[90] border-b border-white/10 bg-[#1565C0]/95 backdrop-blur-md text-white shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 py-3">
            <a
              href="#top"
              className="font-bold font-[Montserrat] text-lg tracking-tight shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-sm"
              onClick={(e) => {
                e.preventDefault();
                containerRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
              }}
            >
              Rolling Rounds
            </a>
            <nav className="flex flex-wrap items-center gap-1 sm:gap-4 text-sm font-medium" aria-label="Primary">
              <button
                type="button"
                onClick={() => scrollToSection("features")}
                className="min-h-[44px] px-2 sm:px-3 rounded-md hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("pricing")}
                className="min-h-[44px] px-2 sm:px-3 rounded-md hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("security")}
                className="min-h-[44px] px-2 sm:px-3 rounded-md hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Security
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("contact")}
                className="min-h-[44px] px-2 sm:px-3 rounded-md hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Contact
              </button>
            </nav>
            <button
              type="button"
              onClick={handleGetStarted}
              className="min-h-[44px] px-4 py-2 rounded-full bg-white text-[#1565C0] text-sm font-bold shadow-md hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1565C0]"
            >
              Get started
            </button>
          </div>
        </header>

      {/* Main content area */}
      <main id="main-content">
        {/* Hero section with parallax */}
        <div
          id="top"
          ref={heroRootRef}
        className="poster-container w-full min-h-screen flex flex-col justify-center items-center px-5 py-10 relative opacity-100 transition-opacity duration-[1000ms] ease-in"
        style={{ background: "linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%)" }}
      >
        {/* Parallax background circles */}
        <div
          className="bg-circle absolute rounded-full bg-white/5 z-0"
          style={{
            width: "300px", height: "300px", top: "-100px", right: "-50px",
            transform: `translateY(${parallaxSlow}px)`,
            transition: "transform 0.1s linear",
          }}
        />
        <div
          className="bg-circle absolute rounded-full bg-white/5"
          style={{
            width: "200px", height: "200px", bottom: "100px", left: "-50px",
            transform: `translateY(${-parallaxMed}px)`,
            transition: "transform 0.1s linear",
          }}
        />
        <div
          className="bg-circle absolute rounded-full bg-white/5"
          style={{
            width: "150px", height: "150px", top: "50%", right: "-30px",
            transform: `translateY(${parallaxSlow}px)`,
            transition: "transform 0.1s linear",
          }}
        />

        {/* Parallax floating icons */}
        <span
          className="floating-icon absolute text-white/10 text-[30px] z-[1]"
          style={{ top: "15%", left: "10%", transform: `translateY(${-parallaxFast}px)`, transition: "transform 0.1s linear" }}
        >
          <span className="material-icons" aria-hidden>local_hospital</span>
        </span>
        <span
          className="floating-icon absolute text-white/10 text-[30px] z-[1]"
          style={{ top: "25%", right: "15%", transform: `translateY(${-parallaxMed}px)`, transition: "transform 0.1s linear" }}
        >
          <span className="material-icons" aria-hidden>medical_services</span>
        </span>
        <span
          className="floating-icon absolute text-white/10 text-[30px] z-[1]"
          style={{ bottom: "25%", left: "12%", transform: `translateY(${parallaxSlow}px)`, transition: "transform 0.1s linear" }}
        >
          <span className="material-icons" aria-hidden>health_and_safety</span>
        </span>
        <span
          className="floating-icon absolute text-white/10 text-[30px] z-[1]"
          style={{ bottom: "30%", right: "10%", transform: `translateY(${parallaxMed}px)`, transition: "transform 0.1s linear" }}
        >
          <span className="material-icons" aria-hidden>monitor_heart</span>
        </span>

        {/* Extra parallax glow layer */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(ellipse at 50% ${30 + parallaxSlow * 0.05}%, rgba(255,255,255,${bgOpacity}), transparent 70%)`,
          }}
        />

        {/* Logo / cart with parallax — smaller on narrow viewports */}
        <div
          className="logo-container relative w-[min(100%,280px)] max-[375px]:w-[min(100%,240px)] h-[min(85vw,380px)] max-[375px]:h-[300px] flex justify-center items-center mb-6 sm:mb-10 z-10 transition-transform duration-[1200ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] order-2 sm:order-1"
          style={{
            transform: `scale(1) translateY(${-parallaxSlow * 0.2}px)`,
          }}
        >
          <div className="cart-wrapper relative w-full max-w-[320px] h-[min(75vw,380px)] max-[375px]:max-h-[300px]">
            <div className="monitor absolute top-[10px] left-1/2 -translate-x-1/2 w-[min(56vw,180px)] h-[min(34vw,130px)] bg-[#f0f4f8] rounded-xl border-4 border-[#2c3e50] shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-[5]">
              <div className="screen w-[calc(100%-16px)] h-[min(26vw,100px)] mx-2 bg-[#1976D2] rounded-md flex justify-center items-center relative overflow-hidden border-2 border-[#2c3e50]">
                <span className="material-icons text-[clamp(28px,8vw,40px)] text-white/90 animate-[iconFloat_3s_ease-in-out_infinite]" aria-hidden>analytics</span>
              </div>
            </div>
            <div className="stand-pole absolute left-1/2 top-[140px] max-[375px]:top-[120px] -translate-x-1/2 w-[24px] h-[min(42vw,160px)] bg-[#e0e0e0] border-l-2 border-r-2 border-[#bdc3c7] z-[1]" />
            <div className="work-surface absolute top-[180px] max-[375px]:top-[155px] left-1/2 -translate-x-1/2 w-[min(68vw,220px)] h-[15px] bg-white rounded-lg border-3 border-[#2c3e50] z-[4] shadow-[0_5px_15px_rgba(0,0,0,0.1)]" />
            <div className="keyboard-tray absolute top-[205px] max-[375px]:top-[175px] left-1/2 -translate-x-1/2 w-[140px] h-[10px] bg-[#90A4AE] rounded border-2 border-[#2c3e50] z-[3]" />
            <div className="cart-base absolute bottom-[60px] left-1/2 -translate-x-1/2 w-[200px] h-[40px] bg-white rounded-[20px] border-3 border-[#2c3e50] z-[2]" />
            <div className="wheels-container absolute bottom-0 left-1/2 -translate-x-1/2 w-[240px] h-[70px] flex justify-between z-[1]">
              <div className="wheel w-[60px] h-[60px] bg-white border-3 border-[#2c3e50] rounded-full relative animate-[spin_3s_linear_infinite]">
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top" />
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top rotate-[120deg]" />
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top rotate-[240deg]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] bg-[#2c3e50] rounded-full" />
              </div>
              <div className="wheel w-[60px] h-[60px] bg-white border-3 border-[#2c3e50] rounded-full relative animate-[spin_3s_linear_infinite]">
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top" />
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top rotate-[120deg]" />
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top rotate-[240deg]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] bg-[#2c3e50] rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Title section — headline first on small screens */}
        <div className="title-section text-center relative z-10 -mt-2 sm:-mt-5 w-full max-w-3xl order-1 sm:order-2">
          <h1
            className={cn(
              "main-title font-[Montserrat] text-[clamp(2rem,7vw,56px)] font-extrabold text-white tracking-tighter mb-2.5 drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)]",
              prefersReducedMotion &&
                "transition-all duration-[800ms] ease-out delay-[500ms] opacity-100 translate-y-0",
            )}
            style={{
              fontFamily: "'Montserrat', sans-serif",
              transform: `translateY(${-parallaxSlow * 0.15}px)`,
              transition: prefersReducedMotion ? undefined : "transform 0.1s linear",
            }}
          >
            {prefersReducedMotion ? (
              "Rolling Rounds"
            ) : (
              <span data-anime-hero-title className="inline-block opacity-0 will-change-transform">
                Rolling Rounds
              </span>
            )}
          </h1>
          <p
            className={cn(
              "subtitle text-[clamp(1rem,3.5vw,1.2rem)] font-light text-white mb-7.5 max-w-[65ch] mx-auto leading-[1.5]",
              prefersReducedMotion &&
                "transition-all duration-[800ms] ease-out delay-[700ms] opacity-100 translate-y-0",
            )}
            style={{
              fontFamily: "'Poppins', sans-serif",
              transform: `translateY(${-parallaxSlow * 0.1}px)`,
              transition: prefersReducedMotion ? undefined : "transform 0.1s linear",
            }}
          >
            {prefersReducedMotion ? (
              "Medical Rounding & Patient List Management"
            ) : (
              <span data-anime-hero-subtitle className="inline-block opacity-0 will-change-transform">
                Medical Rounding & Patient List Management
              </span>
            )}
          </p>

          <div
            className={cn(
              "features flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-5 mt-5",
              prefersReducedMotion &&
                "transition-all duration-[800ms] ease-out delay-[900ms] opacity-100 translate-y-0",
            )}
          >
            <div
              {...(!prefersReducedMotion ? { "data-anime-hero-chip": "" } : {})}
              className={cn(
                "feature-tag group bg-white/20 backdrop-blur-md px-5 py-3 rounded-full text-white text-[0.9rem] font-medium flex items-center gap-2.5 border border-white/35 shadow-sm hover:bg-white/30 hover:-translate-y-1 hover:shadow-md motion-reduce:hover:translate-y-0 transition-all cursor-default",
                !prefersReducedMotion && "opacity-0",
              )}
              title="Works on phone, tablet, and desktop browsers"
            >
              <span className="material-icons text-[22px] shrink-0" aria-hidden>devices</span>
              <span>Mobile access</span>
            </div>
            <div
              {...(!prefersReducedMotion ? { "data-anime-hero-chip": "" } : {})}
              className={cn(
                "feature-tag group bg-white/20 backdrop-blur-md px-5 py-3 rounded-full text-white text-[0.9rem] font-medium flex items-center gap-2.5 border border-white/35 shadow-sm hover:bg-white/30 hover:-translate-y-1 hover:shadow-md motion-reduce:hover:translate-y-0 transition-all cursor-default",
                !prefersReducedMotion && "opacity-0",
              )}
              title="Updates sync across your team"
            >
              <span className="material-icons text-[22px] shrink-0" aria-hidden>speed</span>
              <span>Real-time sync</span>
            </div>
            <button
              type="button"
              {...(!prefersReducedMotion ? { "data-anime-hero-chip": "" } : {})}
              onClick={() => scrollToSection("security")}
              className={cn(
                "feature-tag group bg-white/20 backdrop-blur-md px-5 py-3 rounded-full text-white text-[0.9rem] font-semibold flex items-center gap-2.5 border border-white/35 shadow-sm hover:bg-white/30 hover:-translate-y-1 hover:shadow-md motion-reduce:hover:translate-y-0 transition-all min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1976D2]",
                !prefersReducedMotion && "opacity-0",
              )}
              aria-label="HIPAA-aligned safeguards — jump to Security section"
            >
              <span className="material-icons text-[22px] shrink-0" aria-hidden>cloud_done</span>
              <span>HIPAA-aligned</span>
            </button>
          </div>
        </div>

        {prefersReducedMotion ? (
          <div
            className="cta-section order-3 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-[800ms] ease-out delay-[1100ms] z-10 opacity-100 translate-y-0"
          >
            <button
              type="button"
              onClick={handleGetStarted}
              className="cta-button min-h-[44px] min-w-[min(100%,280px)] bg-white text-[#0D47A1] px-10 py-4 rounded-full text-base font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1976D2] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0"
              aria-label="Create an account or sign in to get started"
            >
              <span>Get started free</span>
              <span className="material-icons text-xl" aria-hidden>rocket_launch</span>
            </button>
            <button
              type="button"
              onClick={handleLaunchPortal}
              className="min-h-[44px] px-8 py-3.5 rounded-full text-base font-semibold text-white border-2 border-white/80 bg-transparent hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1976D2]"
              aria-label={user ? "Open your workspace dashboard" : "Sign in for returning teams"}
            >
              <span>{user ? "Open dashboard" : "Returning? Sign in"}</span>
              <span className="material-icons text-xl" aria-hidden>login</span>
            </button>
          </div>
        ) : (
          <div className="cta-section order-3 mt-10 z-10">
            <div
              data-anime-hero-cta=""
              className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 will-change-transform"
            >
              <button
                type="button"
                onClick={handleGetStarted}
                className="cta-button min-h-[44px] min-w-[min(100%,280px)] bg-white text-[#0D47A1] px-10 py-4 rounded-full text-base font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1976D2] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0"
                aria-label="Create an account or sign in to get started"
              >
                <span>Get started free</span>
                <span className="material-icons text-xl" aria-hidden>rocket_launch</span>
              </button>
              <button
                type="button"
                onClick={handleLaunchPortal}
                className="min-h-[44px] px-8 py-3.5 rounded-full text-base font-semibold text-white border-2 border-white/80 bg-transparent hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1976D2]"
                aria-label={user ? "Open your workspace dashboard" : "Sign in for returning teams"}
              >
                <span>{user ? "Open dashboard" : "Returning? Sign in"}</span>
                <span className="material-icons text-xl" aria-hidden>login</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature highlights section */}
      <FeatureHighlights prefersReducedMotion={prefersReducedMotion} />

      </main>

      <style>{`
        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
};

export default Landing;
