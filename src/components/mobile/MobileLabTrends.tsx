import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Patient } from "@/types/patient";

interface LabValue {
  timestamp: string;
  value: number;
}

interface LabTrendData {
  key: string;
  name: string;
  unit: string;
  values: LabValue[];
  normalLow: number;
  normalHigh: number;
  color: string;
}

interface MobileLabTrendsProps {
  patient: Patient;
  onViewDetails?: () => void;
  className?: string;
}

// Sample lab data generator (would be replaced with actual data)
const generateSampleLabs = (patient: Patient): LabTrendData[] => {
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  // Parse labs from patient data if available
  const labs: LabTrendData[] = [
    {
      key: 'na',
      name: 'Na',
      unit: 'mEq/L',
      values: Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(now - (4 - i) * 8 * hour).toISOString(),
        value: 138 + Math.random() * 6 - 3,
      })),
      normalLow: 136,
      normalHigh: 145,
      color: '#3b82f6',
    },
    {
      key: 'k',
      name: 'K',
      unit: 'mEq/L',
      values: Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(now - (4 - i) * 8 * hour).toISOString(),
        value: 4.0 + Math.random() * 1.5 - 0.5,
      })),
      normalLow: 3.5,
      normalHigh: 5.0,
      color: '#ef4444',
    },
    {
      key: 'cr',
      name: 'Cr',
      unit: 'mg/dL',
      values: Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(now - (4 - i) * 8 * hour).toISOString(),
        value: 1.0 + Math.random() * 0.8,
      })),
      normalLow: 0.7,
      normalHigh: 1.3,
      color: '#8b5cf6',
    },
    {
      key: 'hgb',
      name: 'Hgb',
      unit: 'g/dL',
      values: Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(now - (4 - i) * 8 * hour).toISOString(),
        value: 10 + Math.random() * 4,
      })),
      normalLow: 12,
      normalHigh: 17,
      color: '#ec4899',
    },
    {
      key: 'wbc',
      name: 'WBC',
      unit: 'K/uL',
      values: Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(now - (4 - i) * 8 * hour).toISOString(),
        value: 8 + Math.random() * 8,
      })),
      normalLow: 4,
      normalHigh: 11,
      color: '#22c55e',
    },
    {
      key: 'lactate',
      name: 'Lactate',
      unit: 'mmol/L',
      values: Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(now - (4 - i) * 8 * hour).toISOString(),
        value: 1.0 + Math.random() * 2.5,
      })),
      normalLow: 0.5,
      normalHigh: 2.0,
      color: '#f59e0b',
    },
  ];

  return labs;
};

export function MobileLabTrends({ patient, onViewDetails, className }: MobileLabTrendsProps) {
  const labs = React.useMemo(() => generateSampleLabs(patient), [patient]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between px-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Lab Trends
        </h3>
        {onViewDetails && (
          <Button variant="ghost" size="sm" onClick={onViewDetails} className="gap-1">
            View All
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 px-4 pb-4">
          {labs.map((lab) => (
            <MobileLabCard key={lab.key} lab={lab} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

interface MobileLabCardProps {
  lab: LabTrendData;
}

function MobileLabCard({ lab }: MobileLabCardProps) {
  const latestValue = lab.values[lab.values.length - 1]?.value ?? 0;
  const previousValue = lab.values[lab.values.length - 2]?.value ?? latestValue;
  const isAbnormal = latestValue < lab.normalLow || latestValue > lab.normalHigh;
  const trend = latestValue > previousValue ? 'up' : latestValue < previousValue ? 'down' : 'stable';
  const changePercent = previousValue !== 0
    ? Math.abs(((latestValue - previousValue) / previousValue) * 100).toFixed(1)
    : '0';

  const chartData = lab.values.map(v => ({
    time: new Date(v.timestamp).getHours(),
    value: v.value,
  }));

  return (
    <Card className={cn(
      "flex-shrink-0 w-36 border-t-4",
      isAbnormal ? "border-t-red-500 bg-red-50/50" : "border-t-transparent"
    )}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-sm">{lab.name}</span>
          {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-red-500" />}
          {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-green-500" />}
          {trend === 'stable' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        <div className="flex items-baseline gap-1 mb-2">
          <span className={cn(
            "text-xl font-bold",
            isAbnormal && "text-red-600"
          )}>
            {latestValue.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">{lab.unit}</span>
        </div>

        <div className="h-12 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <ReferenceLine
                y={lab.normalLow}
                stroke="#22c55e"
                strokeDasharray="2 2"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={lab.normalHigh}
                stroke="#22c55e"
                strokeDasharray="2 2"
                strokeOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={isAbnormal ? "#ef4444" : lab.color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
          <span>{lab.normalLow}-{lab.normalHigh}</span>
          <span className={cn(
            trend === 'up' && "text-red-500",
            trend === 'down' && "text-green-500"
          )}>
            {trend !== 'stable' && `${changePercent}%`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact inline lab display for patient detail
interface InlineLabTrendsProps {
  patient: Patient;
  onClick?: () => void;
}

export function InlineLabTrends({ patient, onClick }: InlineLabTrendsProps) {
  const labs = React.useMemo(() => generateSampleLabs(patient).slice(0, 4), [patient]);
  const abnormalCount = labs.filter(l => {
    const latest = l.values[l.values.length - 1]?.value ?? 0;
    return latest < l.normalLow || latest > l.normalHigh;
  }).length;

  return (
    <button
      onClick={onClick}
      className="w-full p-3 bg-secondary/30 rounded-lg border border-border/50 active:bg-secondary/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Lab Trends</span>
        {abnormalCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5">
            {abnormalCount} abnormal
          </Badge>
        )}
      </div>
      <div className="flex gap-3">
        {labs.map(lab => {
          const latest = lab.values[lab.values.length - 1]?.value ?? 0;
          const isAbnormal = latest < lab.normalLow || latest > lab.normalHigh;
          return (
            <div key={lab.key} className="flex-1 text-center">
              <div className="text-[10px] text-muted-foreground">{lab.name}</div>
              <div className={cn(
                "text-sm font-semibold",
                isAbnormal && "text-red-600"
              )}>
                {latest.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}

export default MobileLabTrends;
