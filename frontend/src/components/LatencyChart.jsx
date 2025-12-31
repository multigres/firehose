import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export function LatencyChart({ history }) {
  // Transform data for the chart
  const data = history.map((m, i) => ({
    index: i,
    readP50: m.reads.latency_p50_ms,
    readP99: m.reads.latency_p99_ms,
    writeP50: m.writes.latency_p50_ms,
    writeP99: m.writes.latency_p99_ms,
  }));

  // Only show last 100 points for performance
  const displayData = data.slice(-100);

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Latency (ms)</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="index" hide />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: 'none',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value) => value.toFixed(2) + ' ms'}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="readP50"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              name="Read P50"
            />
            <Line
              type="monotone"
              dataKey="readP99"
              stroke="#86efac"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="Read P99"
            />
            <Line
              type="monotone"
              dataKey="writeP50"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Write P50"
            />
            <Line
              type="monotone"
              dataKey="writeP99"
              stroke="#93c5fd"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="Write P99"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
