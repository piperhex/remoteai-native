import type { QuotaChartData } from '../../vendor/shared/token-usage/quotaHistoryData';
import { dateKey } from '../../vendor/shared/token-usage/chartUtils';

/** The two quota windows insert gaps independently, so align by time rather than array index. */
export function quotaPoints(chart: QuotaChartData) {
  const primary = new Map(chart.primary);
  const secondary = new Map(chart.secondary);
  const timestamps = [...new Set([...primary.keys(), ...secondary.keys()])].sort((left, right) => left - right);
  return timestamps.map((ts) => {
    const date = new Date(ts);
    const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map((value) => String(value).padStart(2, '0')).join(':');
    return { key: String(ts), label: `${dateKey(date)} ${time}`,
      values: [primary.get(ts) ?? null, secondary.get(ts) ?? null] };
  });
}
