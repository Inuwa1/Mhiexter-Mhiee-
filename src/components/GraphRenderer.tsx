import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GraphData {
  data: any[];
  xKey: string;
  yKeys: string[];
  showSlope?: boolean;
}

export default function GraphRenderer({ data, xKey, yKeys, showSlope }: { data: any[], xKey: string, yKeys: string[], showSlope?: boolean }) {
  const chartData = showSlope ? data.map((d, i) => {
    if (i === 0) return { ...d, slope: 0 };
    const prev = data[i - 1];
    const slope = (d[yKeys[0]] - prev[yKeys[0]]) / (d[xKey] - prev[xKey]);
    return { ...d, slope };
  }) : data;
  
  const chartYKeys = showSlope ? [...yKeys, 'slope'] : yKeys;

  return (
    <div className="h-64 w-full bg-zinc-900 p-4 rounded-lg border border-zinc-800">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey={xKey} stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip contentStyle={{ backgroundColor: '#222', border: 'none' }} />
          <Legend />
          {chartYKeys.map((key, index) => (
            <Line key={key} type="monotone" dataKey={key} stroke={index === 0 ? '#8884d8' : index === 1 ? '#82ca9d' : '#ff7300'} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
