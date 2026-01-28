import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
} from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DashboardData, AcuityDistribution } from "@/types/analytics";
import { generateSampleDashboardData } from "@/components/AnalyticsDashboard";

interface MobileAnalyticsProps {
  data?: DashboardData;
  onRefresh?: () => void;
  className?: string;
}

const ACUITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  moderate: '#eab308',
  low: '#22c55e',
  stable: '#3b82f6',
};

export function MobileAnalytics({
  data: providedData,
  onRefresh,
  className,
}: MobileAnalyticsProps) {
  const data = providedData || generateSampleDashboardData();

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-4 space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Unit Analytics</h2>
            <p className="text-xs text-muted-foreground">
              Updated {new Date(data.lastUpdated).toLocaleTimeString()}
            </p>
          </div>
          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Users}
            label="Census"
            value={data.unitMetrics.totalPatients}
            sublabel={`${data.unitMetrics.occupancyRate}% occupancy`}
            color="#3b82f6"
          />
          <MetricCard
            icon={TrendingUp}
            label="Admits (24h)"
            value={data.unitMetrics.admissions24h}
            color="#22c55e"
          />
          <MetricCard
            icon={TrendingDown}
            label="Discharges (24h)"
            value={data.unitMetrics.discharges24h}
            color="#06b6d4"
          />
          <MetricCard
            icon={Activity}
            label="Ventilated"
            value={data.unitMetrics.ventilatedPatients}
            sublabel={`${Math.round((data.unitMetrics.ventilatedPatients / data.unitMetrics.totalPatients) * 100)}%`}
            color="#f59e0b"
          />
        </div>

        {/* Acuity Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Acuity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(data.acuityDistribution).map(([name, value]) => ({
                        name,
                        value,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {Object.keys(data.acuityDistribution).map((key) => (
                        <Cell
                          key={key}
                          fill={ACUITY_COLORS[key as keyof typeof ACUITY_COLORS]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1">
                {Object.entries(data.acuityDistribution).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ACUITY_COLORS[key as keyof typeof ACUITY_COLORS] }}
                    />
                    <span className="text-xs capitalize flex-1">{key}</span>
                    <span className="text-xs font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Completion */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Task Completion</span>
              <span className="text-lg font-bold text-primary">
                {data.taskMetrics.completionRate.toFixed(0)}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={data.taskMetrics.completionRate} className="h-2 mb-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500 mx-auto mb-1" />
                <div className="text-sm font-semibold text-green-700">
                  {data.taskMetrics.completedTasks}
                </div>
                <div className="text-[10px] text-green-600">Completed</div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                <div className="text-sm font-semibold text-amber-700">
                  {data.taskMetrics.pendingTasks}
                </div>
                <div className="text-[10px] text-amber-600">Pending</div>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500 mx-auto mb-1" />
                <div className="text-sm font-semibold text-red-700">
                  {data.taskMetrics.overdueTasks}
                </div>
                <div className="text-[10px] text-red-600">Overdue</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Flow Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Patient Flow (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.patientFlow}>
                  <XAxis
                    dataKey="date"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Bar dataKey="admissions" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="discharges" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-xs text-muted-foreground">Admissions</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-cyan-500 rounded" />
                <span className="text-xs text-muted-foreground">Discharges</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Protocol Compliance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Protocol Compliance</span>
              <span className={cn(
                "text-lg font-bold",
                data.protocolMetrics.complianceRate >= 90 ? "text-green-600" : "text-amber-600"
              )}>
                {data.protocolMetrics.complianceRate.toFixed(0)}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.protocolMetrics.protocolsByType).slice(0, 4).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-xs capitalize flex-1">{type}</span>
                  <div className="w-24">
                    <Progress value={Math.min(100, count * 15)} className="h-1.5" />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alert Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Alert Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">
                  {data.alertMetrics.criticalAlerts}
                </div>
                <div className="text-xs text-red-700">Critical Alerts</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {data.alertMetrics.acknowledgedAlerts}
                </div>
                <div className="text-xs text-green-700">Acknowledged</div>
              </div>
            </div>
            <div className="mt-3 text-center text-xs text-muted-foreground">
              Avg response time: {data.alertMetrics.avgResponseTime} min
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sublabel?: string;
  color: string;
}

function MetricCard({ icon: Icon, label, value, sublabel, color }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sublabel && (
              <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
            )}
          </div>
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MobileAnalytics;
