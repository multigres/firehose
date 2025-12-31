import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatQPS } from '../utils/formatting';

export function ThroughputChart({ history }) {
  // Transform data for the chart
  const data = history.map((m, i) => ({
    index: i,
    reads: m.reads.qps,
    writes: m.writes.qps,
  }));

  // Only show last 100 points for performance
  const displayData = data.slice(-100);

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Throughput (QPS)</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="index" hide />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
              tickFormatter={(v) => formatQPS(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: 'none',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value) => formatQPS(value) + ' qps'}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="reads"
              stackId="1"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.6}
              name="Reads"
            />
            <Area
              type="monotone"
              dataKey="writes"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
              name="Writes"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
