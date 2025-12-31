import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function ErrorChart({ history }) {
  // Transform data for the chart - show errors per interval
  const data = history.map((m, i) => ({
    index: i,
    readErrors: m.reads.errors,
    writeErrors: m.writes.errors,
  }));

  // Only show last 100 points for performance
  const displayData = data.slice(-100);

  const hasErrors = displayData.some(
    (d) => d.readErrors > 0 || d.writeErrors > 0
  );

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Errors</h2>
      <div className="h-48">
        {hasErrors ? (
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
              />
              <Line
                type="monotone"
                dataKey="readErrors"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Read Errors"
              />
              <Line
                type="monotone"
                dataKey="writeErrors"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                name="Write Errors"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            No errors
          </div>
        )}
      </div>
    </div>
  );
}
