import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Brain, ChevronRight, LineChart } from "lucide-react";
import type { CommandCenterPatient } from "@/types/command-center";
import { cn } from "@/lib/utils";

const statusStyles: Record<CommandCenterPatient["status"], string> = {
  stable: "text-teal-300 bg-teal-500/15",
  watch: "text-cyan-300 bg-cyan-500/15",
  critical: "text-amber-300 bg-amber-500/20",
};

interface PatientCardProps {
  patient: CommandCenterPatient;
  focused: boolean;
  dimmed: boolean;
  aiActive: boolean;
  onToggleFocus: () => void;
}

export const PatientCard = ({ patient, focused, dimmed, aiActive, onToggleFocus }: PatientCardProps) => {
  return (
    <motion.article
      layout
      whileHover={{ y: -4 }}
      onClick={onToggleFocus}
      className={cn(
        "group cursor-pointer rounded-3xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.55)] transition",
        focused && "ring-1 ring-cyan-400/50",
        patient.status === "critical" && "animate-pulse border-amber-400/40",
        aiActive && "border-violet-400/60 shadow-[0_0_30px_rgba(139,92,246,0.25)]",
        dimmed && !focused && "opacity-50"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{patient.room}</p>
          <h3 className="text-lg font-semibold text-slate-100">{patient.name}</h3>
        </div>
        <div className={cn("rounded-full px-2 py-1 text-[11px] font-semibold", statusStyles[patient.status])}>
          {patient.status.toUpperCase()}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Ventilation</p>
          <p className="mt-1 text-sm text-slate-100">{patient.ventilation}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Neuro</p>
          <p className="mt-1 text-sm text-slate-100">{patient.neuroSummary}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {patient.labs.map((lab) => (
          <div key={lab.name} className="rounded-2xl border border-white/10 bg-slate-900/50 p-2 text-xs">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{lab.name}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-slate-100">{lab.value}</span>
              <TrendIcon trend={lab.trend} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/60 to-slate-900/30 p-2 text-xs text-slate-300">
        <LineChart className="h-4 w-4 text-cyan-300" />
        <VitalsSparkline values={patient.sparkline} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
        {patient.activeProblems.map((problem) => (
          <span key={problem} className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            {problem}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 space-y-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs"
          >
            <DetailRow label="Imaging" value={patient.imagingSummary} />
            <DetailRow label="Orders Due" value={patient.ordersDue.join(" • ")} />
            <DetailRow label="Nursing Alerts" value={patient.nursingAlerts.join(" • ")} />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1">
                <Brain className="h-3.5 w-3.5 text-violet-300" />
                AI active: hemodynamics review
              </div>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" }) => {
  if (trend === "up") {
    return <ArrowUpRight className="h-3.5 w-3.5 text-amber-300" />;
  }
  if (trend === "down") {
    return <ArrowDownRight className="h-3.5 w-3.5 text-emerald-300" />;
  }
  return <div className="h-1.5 w-1.5 rounded-full bg-slate-500" />;
};

const VitalsSparkline = ({ values }: { values: number[] }) => {
  const max = Math.max(...values);
  return (
    <div className="flex flex-1 items-end gap-1">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="h-6 w-1.5 rounded-full bg-gradient-to-t from-cyan-500/20 to-cyan-300"
          style={{ height: `${Math.max(20, (value / max) * 24)}px` }}
        />
      ))}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
    <p className="mt-1 text-sm text-slate-100">{value}</p>
  </div>
);
