import { memo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';

function SpeedGraph({ data = [], mini = false }) {
  const chartData = data.map((d, i) => ({
    idx: i,
    speed: d.speed || 0,
  }));

  if (mini) {
    return (
      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="speed"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Download Speed</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="idx" hide />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v) => formatSpeed(v)}
              width={60}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '12px',
              }}
              formatter={(value) => [formatSpeed(value), 'Speed']}
              labelFormatter={() => ''}
            />
            <Line
              type="monotone"
              dataKey="speed"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let i = 0;
  let speed = bytesPerSec;
  while (speed >= 1024 && i < units.length - 1) {
    speed /= 1024;
    i++;
  }
  return `${speed.toFixed(1)} ${units[i]}`;
}

export default memo(SpeedGraph);
