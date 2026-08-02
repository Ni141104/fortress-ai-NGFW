import { useEffect, useRef, useState } from "react";

export interface MetricSeries {
  history: Record<string, number[]>;
  trend: Record<string, number>;
}

const MAX_POINTS = 30;

/**
 * Rolling history for any set of live metrics published by the simulation
 * engine. Widgets pass the current values on every snapshot; the hook keeps
 * the sparkline series and a percentage trend versus the start of the window.
 */
export function useMetricSeries(values: Record<string, number>, maxPoints = MAX_POINTS): MetricSeries {
  const [series, setSeries] = useState<MetricSeries>({ history: {}, trend: {} });
  const signature = JSON.stringify(values);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    setSeries((prev) => {
      const history: Record<string, number[]> = {};
      const trend: Record<string, number> = {};
      for (const [key, value] of Object.entries(valuesRef.current)) {
        const next = [...(prev.history[key] ?? []), Number.isFinite(value) ? value : 0].slice(
          -maxPoints,
        );
        history[key] = next;
        const first = next[0] ?? 0;
        const last = next[next.length - 1] ?? 0;
        trend[key] = first === 0 ? (last === 0 ? 0 : 100) : ((last - first) / Math.abs(first)) * 100;
      }
      return { history, trend };
    });
  }, [signature, maxPoints]);

  return series;
}