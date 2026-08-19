/**
 * LEDGERIX DESIGN SYSTEM — RECHARTS THEME
 *
 * Recharts takes colours as props rather than reading CSS, so charts drift
 * off-system faster than anything else in an app. This module supplies the
 * prop bundles and a themed tooltip so a chart is on-system by spreading a
 * few objects instead of remembering eight values.
 *
 * Usage:
 *
 *   import { axisProps, gridProps, LedgerixTooltip, useChartTheme, AreaGradient }
 *     from "../design-system/ledgerix/react/charts";
 *
 *   const t = useChartTheme();
 *
 *   <AreaChart data={data}>
 *     <defs><AreaGradient id="rev" /></defs>
 *     <CartesianGrid {...gridProps} />
 *     <XAxis dataKey="month" {...axisProps} />
 *     <YAxis {...axisProps} tickFormatter={compactCurrency} />
 *     <Tooltip content={<LedgerixTooltip />} cursor={t.cursor} />
 *     <Area dataKey="revenue" stroke={t.series[0]} fill="url(#rev)"
 *           strokeWidth={2.5} />
 *   </AreaChart>
 *
 * `useChartTheme` reads live CSS variables, so charts follow light/dark
 * without a re-mount — provided you pass `theme` (or any value that changes
 * on theme switch) so React re-renders. See `useChartTheme` below.
 */

import * as React from "react";
import { readToken } from "../tokens";

/* ==========================================================================
   STATIC PROP BUNDLES
   These reference CSS variables directly and so need no JS theme awareness.
   ========================================================================== */

/** Horizontal rules only. Vertical grid lines are noise in a time series. */
export const gridProps = {
  strokeDasharray: "0",
  vertical: false,
  stroke: "var(--lx-chart-grid)",
} as const;

/** No axis line, no tick marks — the labels are the axis. */
export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: {
    fill: "var(--lx-text-muted)",
    fontSize: 12,
    fontWeight: 500,
  },
  tickMargin: 10,
} as const;

/** Sensible plot padding: room for the tooltip and the top-most label. */
export const chartMargin = { top: 8, right: 8, bottom: 0, left: 0 } as const;

/* ==========================================================================
   LIVE THEME
   ========================================================================== */

export interface ChartTheme {
  series: string[];
  brand: string;
  signal: string;
  neutral: string;
  grid: string;
  axis: string;
  text: string;
  textMuted: string;
  surface: string;
  positive: string;
  negative: string;
  /** Hover cursor styling for <Tooltip cursor={…}>. */
  cursor: { fill: string } & Record<string, unknown>;
}

/**
 * Resolve the chart palette from live CSS variables.
 *
 * Pass the current theme name (or anything that changes when the theme
 * changes) as `themeKey` so the values are recomputed on switch. Without it
 * the hook resolves once on mount and the chart keeps the old palette.
 */
export function useChartTheme(themeKey?: string): ChartTheme {
  return React.useMemo(() => {
    const t = (name: string, fallback: string) => readToken(name, fallback);
    return {
      series: [
        t("chart-1", "#00a257"),
        t("chart-2", "#5b8def"),
        t("chart-3", "#8b74f0"),
        t("chart-4", "#b06e00"),
        t("chart-5", "#1f8b88"),
        t("chart-6", "#e5484d"),
        t("chart-7", "#6f9212"),
        t("chart-8", "#8a9186"),
      ],
      brand: t("brand", "#00c56a"),
      signal: t("signal", "#c8f94e"),
      neutral: t("chart-neutral", "#8a9186"),
      grid: t("chart-grid", "#e2e6de"),
      axis: t("chart-axis", "#a8b0a3"),
      text: t("text", "#0d0f0c"),
      textMuted: t("text-muted", "#8a9186"),
      surface: t("surface", "#ffffff"),
      positive: t("positive", "#007f44"),
      negative: t("negative", "#b4242d"),
      cursor: { fill: t("surface-hover", "#eef1ea") },
    };
    // themeKey is the invalidation signal; the token reads are the real work.
  }, [themeKey]);
}

/* ==========================================================================
   THE HOUSE PATTERN — "one bright, rest quiet"
   ========================================================================== */

/**
 * Per-mark fills where a single bar/cell is emphasised and the rest recede.
 * Render with <Cell> so each mark takes its own colour:
 *
 *   const fills = useEmphasisFills(data.length, currentMonthIndex);
 *   <Bar dataKey="value" radius={[8, 8, 0, 0]}>
 *     {data.map((d, i) => <Cell key={d.month} fill={fills[i]} />)}
 *   </Bar>
 */
export function useEmphasisFills(
  length: number,
  emphasisIndex: number,
  opts: { themeKey?: string; tone?: "brand" | "signal" } = {},
): string[] {
  const theme = useChartTheme(opts.themeKey);
  const bright = opts.tone === "signal" ? theme.signal : theme.brand;
  return React.useMemo(
    () =>
      Array.from({ length }, (_, i) =>
        i === emphasisIndex ? bright : theme.neutral,
      ),
    [length, emphasisIndex, bright, theme.neutral],
  );
}

/* ==========================================================================
   GRADIENT
   ========================================================================== */

export interface AreaGradientProps {
  id: string;
  /** Any CSS colour. Defaults to the brand green. */
  color?: string;
  from?: number;
  to?: number;
}

/**
 * The green wash under a line. Drop inside <defs> and reference as
 * `fill="url(#id)"`.
 */
export function AreaGradient({
  id,
  color = "var(--lx-chart-1)",
  from = 0.28,
  to = 0,
}: AreaGradientProps) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  );
}

/* ==========================================================================
   TOOLTIP
   ========================================================================== */

interface TooltipPayloadItem {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
}

export interface LedgerixTooltipProps {
  /* Recharts injects these; all optional so the component can be passed bare
     as `content={<LedgerixTooltip />}`. */
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  /** Format each value — usually a currency formatter. */
  formatter?: (value: string | number, name?: string | number) => React.ReactNode;
  labelFormatter?: (label: string | number) => React.ReactNode;
}

export function LedgerixTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: LedgerixTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="lx-chart__tooltip">
      {label != null && (
        <div className="lx-chart__tooltip-label">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      {payload.map((item, i) => (
        <div
          key={item.dataKey ?? i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          {item.color && (
            <span
              className="lx-chart__swatch"
              style={{ backgroundColor: item.color }}
            />
          )}
          {item.name != null && <span>{item.name}</span>}
          <strong style={{ marginLeft: "auto" }}>
            {formatter && item.value != null
              ? formatter(item.value, item.name)
              : item.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   LEGEND
   Recharts' built-in legend is hard to style; this one is plain DOM and sits
   in the card header where legends belong.
   ========================================================================== */

export interface ChartLegendProps {
  items: Array<{ label: string; color: string }>;
  className?: string;
}

export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <div className={["lx-chart__legend", className].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <span key={item.label} className="lx-chart__legend-item">
          <span
            className="lx-chart__swatch"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ==========================================================================
   FORMATTERS
   ========================================================================== */

/** 48210 → "$48.2K". Axis ticks and compact tooltips. */
export function compactCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** 48210 → "48.2K". Counts, not money. */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
