import * as React from "react";
import { motion } from "framer-motion";
import { Clipboard, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CommandCenterPatient } from "@/types/command-center";

interface AiReasoningPanelProps {
  focusedPatient: CommandCenterPatient | null;
}

const suggestions = [
  "Is anyone ready for extubation?",
  "Summarize neuro status",
  "Flag worsening shock",
];

const taskSuggestions = [
  "Reassess sedation goals",
  "Review pressor wean",
  "Update family communication",
];

export const AiReasoningPanel = ({ focusedPatient }: AiReasoningPanelProps) => {
  const [streamIndex, setStreamIndex] = React.useState(0);
  const streamText = focusedPatient
    ? `AI reviewing ${focusedPatient.name}'s labs, vent settings, and neuro exam for trajectory trends.`
    : "AI scanning the census for instability, care gaps, and escalation opportunities.";

  React.useEffect(() => {
    setStreamIndex(0);
    const interval = window.setInterval(() => {
      setStreamIndex((prev) => {
        if (prev >= streamText.length) {
          window.clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 24);
    return () => window.clearInterval(interval);
  }, [streamText]);

  return (
    <aside className="flex h-full w-full flex-col gap-4 border-l border-white/10 bg-slate-950/60 px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">AI Reasoning</p>
          <h2 className="text-lg font-semibold text-slate-100">Clinical Copilot</h2>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold",
            focusedPatient
              ? "bg-violet-500/20 text-violet-200"
              : "bg-cyan-500/15 text-cyan-200"
          )}
        >
          {focusedPatient ? "CURRENT PATIENT" : "GLOBAL CENSUS"}
        </span>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-slate-900/40 to-violet-500/10 p-4 text-sm text-slate-200">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
          <Sparkles className="h-4 w-4 text-violet-300" />
          Active Context
        </div>
        <motion.p
          key={streamText}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="leading-relaxed"
        >
          {streamText.slice(0, streamIndex)}
        </motion.p>
      </div>

      <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Suggested Questions</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((item) => (
            <Button
              key={item}
              variant="ghost"
              size="sm"
              className="h-auto rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">AI Generated Tasks</p>
        <ul className="space-y-2 text-sm text-slate-200">
          {taskSuggestions.map((task) => (
            <li key={task} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              {task}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto space-y-3">
        <Button className="w-full gap-2 rounded-2xl bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30">
          <FileText className="h-4 w-4" />
          Generate Daily Plan
        </Button>
        <Button className="w-full gap-2 rounded-2xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
          <Clipboard className="h-4 w-4" />
          Insert Plan into Note
        </Button>
      </div>
    </aside>
  );
};
