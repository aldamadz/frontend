// frontend/src/components/dashboard/StatusChart.tsx
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface StatusChartData {
  name: string;
  value: number;
}

interface StatusChartProps {
  data: StatusChartData[];
}

// Konsisten dengan nama status yang dikirim dari dashboard.service.ts
const STATUS_COLORS: Record<string, string> = {
  'Completed': '#10b981', // Emerald 500
  'Ongoing': '#3b82f6',   // Blue 500
  'Scheduled': '#6366f1', // Indigo 500
  'Overdue': '#ef4444',   // Red 500
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 border border-border p-3 rounded-xl shadow-xl backdrop-blur-sm">
        <p className="text-[11px] font-bold text-foreground mb-1">{payload[0].name}</p>
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: payload[0].payload.fill }} 
          />
          <p className="text-sm font-black text-primary">
            {payload[0].value} <span className="text-[10px] font-medium text-muted-foreground">Agenda</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const StatusChart = ({ data }: StatusChartProps) => {
  const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);
  const hasData = totalValue > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm h-full flex flex-col min-h-[350px]"
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          Distribusi Status
          {hasData && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black">
              {totalValue} TOTAL
            </span>
          )}
        </h3>
        <p className="text-xs text-muted-foreground">Persentase progress tim saat ini</p>
      </div>

      <div className="flex-1 w-full min-h-[250px] relative">
        {!hasData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Tidak ada data untuk ditampilkan</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={5}
                dataKey="value"
                animationDuration={1000}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STATUS_COLORS[entry.name] || '#94a3b8'} 
                    className="hover:opacity-80 transition-opacity outline-none"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                content={({ payload }) => (
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {payload?.map((entry: any, index: number) => (
                      <div key={`item-${index}`} className="flex items-center gap-1.5">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: STATUS_COLORS[entry.value] }} 
                        />
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
};