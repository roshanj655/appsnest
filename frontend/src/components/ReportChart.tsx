import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { rupee } from '@/lib/reportCharts'

type Series = {
  key: string
  name: string
  color: string
}

type ReportChartProps = {
  title: string
  description?: string
  data: Array<Record<string, string | number>>
  xKey: string
  series: Series[]
  type?: 'bar' | 'line' | 'pie'
  layout?: 'horizontal' | 'vertical'
  height?: number
  valueFormat?: 'money' | 'number'
}

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  color: 'hsl(var(--foreground))',
  fontSize: 12
}

const formatValue = (value: number, valueFormat: 'money' | 'number') =>
  valueFormat === 'money' ? rupee(value) : Number(value || 0).toLocaleString('en-IN')

const ReportChart = ({
  title,
  description,
  data,
  xKey,
  series,
  type = 'bar',
  layout = 'horizontal',
  height = 280,
  valueFormat = 'money'
}: ReportChartProps) => {
  const empty = !data.length || data.every((row) => series.every((item) => !Number(row[item.key])))

  const valueTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-xl border bg-card px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 font-medium">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: {formatValue(Number(entry.value || 0), valueFormat)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No chart data for this range yet.
          </p>
        ) : (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              {type === 'pie' ? (
                <PieChart>
                  <Pie
                    data={data}
                    dataKey={series[0].key}
                    nameKey={xKey}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {data.map((row, index) => (
                      <Cell
                        key={String(row[xKey])}
                        fill={String(row.color || series[index % series.length]?.color || '#22d3ee')}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={valueTooltip} />
                  <Legend />
                </PieChart>
              ) : type === 'line' ? (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey={xKey} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(value) => formatValue(Number(value), valueFormat)}
                  />
                  <Tooltip content={valueTooltip} />
                  <Legend />
                  {series.map((item) => (
                    <Line
                      key={item.key}
                      type="monotone"
                      dataKey={item.key}
                      name={item.name}
                      stroke={item.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={data} layout={layout === 'vertical' ? 'vertical' : 'horizontal'}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  {layout === 'vertical' ? (
                    <>
                      <XAxis
                        type="number"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickFormatter={(value) => formatValue(Number(value), valueFormat)}
                      />
                      <YAxis
                        type="category"
                        dataKey={xKey}
                        width={110}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                    </>
                  ) : (
                    <>
                      <XAxis dataKey={xKey} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickFormatter={(value) => formatValue(Number(value), valueFormat)}
                      />
                    </>
                  )}
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatValue(Number(value ?? 0), valueFormat)}
                  />
                  <Legend />
                  {series.map((item) => (
                    <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} radius={[6, 6, 0, 0]} />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ReportChart
