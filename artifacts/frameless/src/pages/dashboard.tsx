import { useGetDashboardStats, useGetCashFlow, useGetRecentActivity } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { Activity, CreditCard, Film, Users, TrendingUp, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: cashFlow, isLoading: cashFlowLoading } = useGetCashFlow({ months: 6 });
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity({ limit: 5 });

  if (statsLoading || cashFlowLoading || activityLoading) {
    return <div className="flex h-full items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>;
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-4xl font-heading tracking-wider mb-2 text-white">Control Room</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold">Operational Overview</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Net Profit" 
          value={formatCurrency(stats?.netProfit || 0)} 
          icon={TrendingUp}
          trend="+12.5%"
          trendUp={true}
        />
        <KpiCard 
          title="Active Projects" 
          value={(stats?.activeProjects || 0).toString()} 
          icon={Film}
        />
        <KpiCard 
          title="Pending Invoices" 
          value={formatCurrency(stats?.pendingInvoiceAmount || 0)} 
          icon={CreditCard}
          subtitle={`${stats?.pendingInvoices || 0} awaiting payment`}
        />
        <KpiCard 
          title="Overdue" 
          value={(stats?.overdueInvoices || 0).toString()} 
          icon={AlertCircle}
          alert={!!stats?.overdueInvoices && stats.overdueInvoices > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cash Flow Chart */}
        <Card className="col-span-1 lg:col-span-2 glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">6-Month Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlow || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="rgba(255,255,255,0.5)" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.5)" 
                    fontSize={12}
                    tickFormatter={(value) => `Rp ${value / 1000000}M`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(20,25,35,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Area type="monotone" dataKey="income" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Live Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentActivity?.map((activity) => (
                <div key={activity.id} className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-[-24px] last:before:bottom-0 before:w-[2px] before:bg-white/10">
                  <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center z-10">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              {(!recentActivity || recentActivity.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, trend, trendUp, subtitle, alert }: any) {
  return (
    <Card className={`glass-panel border-white/5 relative overflow-hidden group ${alert ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{title}</p>
          <div className={`p-2 rounded-md ${alert ? 'bg-destructive/20 text-destructive' : 'bg-white/5 text-primary'}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className={`text-2xl font-bold tracking-tight ${alert ? 'text-destructive' : 'text-white'}`}>{value}</h3>
          {trend && (
            <p className={`text-xs font-medium ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
              {trend} from last month
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
