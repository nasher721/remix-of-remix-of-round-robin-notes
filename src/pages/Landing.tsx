import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Variants,
} from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import FeatureHighlights from "@/components/landing/FeatureHighlights";

const featureChips = [
  { icon: "devices", label: "Mobile access" },
  { icon: "speed", label: "Realtime sync" },
  { icon: "lock", label: "HIPAA secure" },
  { icon: "task", label: "Team tasks" },
];

const checklist = [
  "Live sign-outs with change tracking",
  "Bedside-ready layout for ICU teams",
  "Exportable notes for handoff & reports",
];

const signalCards = [
  { label: "Rounds", value: "In progress", tone: "bg-primary/15 text-primary" },
  { label: "Drafts", value: "Auto-saved", tone: "bg-emerald-50 text-emerald-600" },
  { label: "Alerts", value: "Labs updated", tone: "bg-amber-50 text-amber-700" },
];

const CartWheel: React.FC<{ shouldReduceMotion: boolean }> = ({ shouldReduceMotion }) => (
  <motion.div
    className="relative h-10 w-10 rounded-full border-2 border-slate-500 bg-white"
    animate={shouldReduceMotion ? undefined : { rotate: 360 }}
    transition={shouldReduceMotion ? undefined : { duration: 2.7, repeat: Infinity, ease: "linear" }}
  >
    <span className="absolute left-1/2 top-1 h-4 w-0.5 -translate-x-1/2 bg-slate-500" />
    <span className="absolute left-1/2 top-1 h-4 w-0.5 -translate-x-1/2 rotate-[120deg] bg-slate-500" />
    <span className="absolute left-1/2 top-1 h-4 w-0.5 -translate-x-1/2 rotate-[240deg] bg-slate-500" />
    <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500" />
  </motion.div>
);

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const handleLaunchPortal = () => {
    if (user) {
      navigate("/", { replace: true });
      window.location.reload();
    } else {
      navigate("/auth");
    }
  };

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const stagger: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  };

  const float: TargetAndTransition | undefined = shouldReduceMotion
    ? undefined
    : {
        y: [0, -12, 0],
        scale: [1, 1.02, 1],
        transition: { duration: 8, repeat: Infinity, ease: [0.37, 0, 0.63, 1] },
      };

  return (
    <div className="landing-page min-h-screen relative overflow-hidden bg-background text-foreground">
      <motion.div
        className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        animate={float}
      />
      <motion.div
        className="pointer-events-none absolute -right-24 top-10 h-[320px] w-[320px] rounded-full bg-sky-400/20 blur-3xl"
        animate={float}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <section className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 pt-20 pb-16 md:flex-row md:items-center md:pt-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-sky-500/10 to-background" />
        <motion.div className="flex-1 space-y-6" variants={stagger} initial="hidden" animate="visible">
          <motion.span
            variants={fadeUp}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary ring-1 ring-primary/20"
          >
            <span className="material-icons text-base">auto_awesome</span>
            ICU-ready workflows
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl"
          >
            Rolling Rounds
            <span className="block text-[92%] text-muted-foreground">
              Clinical documentation built for bedside teams
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="max-w-2xl text-lg text-muted-foreground">
            Organize patients, capture handoffs, and keep the team in sync with realtime updates
            across mobile and desktop.
          </motion.p>

          <motion.div variants={stagger} className="flex flex-wrap gap-2">
            {featureChips.map((chip) => (
              <motion.span
                key={chip.label}
                variants={fadeUp}
                whileHover={{ y: shouldReduceMotion ? 0 : -2, scale: shouldReduceMotion ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur"
              >
                <span className="material-icons text-base text-primary">{chip.icon}</span>
                {chip.label}
              </motion.span>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <motion.button
              whileHover={{ y: shouldReduceMotion ? 0 : -2, scale: shouldReduceMotion ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLaunchPortal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform"
            >
              Launch portal
              <span className="material-icons text-base">login</span>
            </motion.button>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live sync keeps bedside and desktop aligned
            </div>
          </motion.div>

          <motion.ul variants={stagger} className="grid gap-3 md:grid-cols-2">
            {checklist.map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="flex items-start gap-2 rounded-xl bg-white/70 px-4 py-3 text-sm font-medium text-foreground shadow-sm ring-1 ring-foreground/5 backdrop-blur"
              >
                <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/15 text-primary">
                  <span className="material-icons text-sm leading-5">check</span>
                </span>
                <span className="text-left text-muted-foreground">{item}</span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div className="relative flex-1" variants={fadeUp} initial="hidden" animate="visible">
          <motion.div
            className="relative overflow-hidden rounded-3xl bg-white/80 p-6 shadow-xl ring-1 ring-foreground/10 backdrop-blur"
            animate={float}
          >
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="material-icons text-primary">monitor_heart</span>
                Patient list
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Live updates
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {signalCards.map((card) => (
                <div
                  key={card.label}
                  className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm font-semibold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-icons text-base text-primary">arrow_forward</span>
                    {card.label}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${card.tone}`}>
                    {card.value}
                  </span>
                </div>
              ))}
            </div>

            <motion.div
              className="mt-6 rounded-2xl border border-slate-300/70 bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-4"
              animate={shouldReduceMotion ? undefined : { y: [0, -4, 0] }}
              transition={shouldReduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="relative mx-auto h-40 w-52">
                <div className="absolute left-1/2 top-2 h-16 w-24 -translate-x-1/2 rounded-lg border-2 border-slate-600 bg-white shadow-sm">
                  <div className="mx-1 mt-1 flex h-12 items-center justify-center rounded bg-primary/85 text-white">
                    <span className="material-icons text-lg">analytics</span>
                  </div>
                </div>
                <div className="absolute left-1/2 top-[68px] h-8 w-2 -translate-x-1/2 rounded bg-slate-400" />
                <div className="absolute left-1/2 top-[88px] h-2 w-28 -translate-x-1/2 rounded bg-slate-500/50" />
                <div className="absolute left-1/2 top-[95px] h-8 w-36 -translate-x-1/2 rounded-full border-2 border-slate-600 bg-white" />
                <div className="absolute bottom-0 left-1/2 flex w-40 -translate-x-1/2 items-center justify-between">
                  <CartWheel shouldReduceMotion={shouldReduceMotion ?? false} />
                  <CartWheel shouldReduceMotion={shouldReduceMotion ?? false} />
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            className="absolute -bottom-6 -left-6 w-[220px] rounded-2xl bg-primary text-primary-foreground p-4 shadow-xl ring-4 ring-primary/20"
            animate={float}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="material-icons text-base">radar</span>
              Shift snapshot
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>Patients followed</span>
                <span className="font-bold">12</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Tasks due</span>
                <span className="font-bold">5</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Sign-outs</span>
                <span className="font-bold">ready</span>
              </li>
            </ul>
          </motion.div>
        </motion.div>
      </section>

      <motion.div
        id="feature-highlights"
        className="relative"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-120px" }}
        variants={fadeUp}
      >
        <FeatureHighlights />
      </motion.div>
    </div>
  );
};

export default Landing;
