import React, { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSalesForecast, getLowStockPrediction } from '../services/geminiService';
import { ICONS } from '../constants';

const salesByDay = [
  { name: 'Mon', sales: 4000 }, { name: 'Tue', sales: 3000 }, { name: 'Wed', sales: 2000 },
  { name: 'Thu', sales: 2780 }, { name: 'Fri', sales: 1890 }, { name: 'Sat', sales: 2390 },
  { name: 'Sun', sales: 3490 }, { name: 'Last Mon', sales: 4200 }, { name: 'Last Tue', sales: 3100 },
];

const topProductsData = [
  { name: 'Sourdough Bread', value: 400 }, { name: 'Milk', value: 300 },
  { name: 'Eggs', value: 300 }, { name: 'Avocado', value: 200 },
];
const COLORS = ['#4f46e5', '#10b981', '#3b82f6', '#f97316'];

const revenueComparison = [
    {name: 'Jan', thisYear: 4000, lastYear: 2400}, {name: 'Feb', thisYear: 3000, lastYear: 1398},
    {name: 'Mar', thisYear: 5000, lastYear: 6800}, {name: 'Apr', thisYear: 2780, lastYear: 3908},
];


const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <div style={{ width: '100%', height: 300 }}>
            {children}
        </div>
    </div>
);

const AIInsightCard: React.FC<{ title: string; insight: string | null; loading: boolean }> = ({ title, insight, loading }) => (
    <div className="bg-indigo-50 dark:bg-indigo-900/40 p-6 rounded-xl shadow-sm border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center gap-3 mb-3">
            {ICONS.Lightbulb}
            <h2 className="text-xl font-semibold text-indigo-800 dark:text-indigo-200">{title}</h2>
        </div>
        {loading && <p className="text-indigo-600 dark:text-indigo-300">Generating insights...</p>}
        {insight && !loading && <p className="text-indigo-700 dark:text-indigo-200">{insight}</p>}
    </div>
);

const Reports: React.FC = () => {
    const [salesForecast, setSalesForecast] = useState<string | null>(null);
    const [lowStockPrediction, setLowStockPrediction] = useState<string | null>(null);
    const [loadingForecast, setLoadingForecast] = useState(true);
    const [loadingStock, setLoadingStock] = useState(true);
    const [dateRange, setDateRange] = useState(7);

    useEffect(() => {
        getSalesForecast().then(setSalesForecast).finally(() => setLoadingForecast(false));
        getLowStockPrediction().then(setLowStockPrediction).finally(() => setLoadingStock(false));
    }, []);

    const getFilteredSalesData = () => {
        // This is a simulation. In a real app, you'd filter actual sales data by date.
        if (dateRange === 30) return salesByDay.slice(0, 9);
        if (dateRange === 15) return salesByDay.slice(0, 7);
        return salesByDay.slice(0, 5);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-3xl font-bold">Reports & Analytics</h1>
                 <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                     {[7, 15, 30].map(days => (
                         <button 
                            key={days} 
                            onClick={() => setDateRange(days)} 
                            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dateRange === days ? 'bg-brand-primary text-white' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                             Last {days} Days
                         </button>
                     ))}
                 </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AIInsightCard title="AI Sales Forecast" insight={salesForecast} loading={loadingForecast} />
                <AIInsightCard title="AI Inventory Prediction" insight={lowStockPrediction} loading={loadingStock} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title={`Sales by Day (Last ${dateRange} Days)`}>
                    <ResponsiveContainer>
                        <BarChart data={getFilteredSalesData()}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.3)" />
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                            <YAxis tick={{ fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: '#4f46e5' }} />
                            <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Top Selling Products">
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={topProductsData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name">
                                {topProductsData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: '#4f46e5' }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
                <div className="lg:col-span-2">
                    <ChartCard title="Revenue Comparison (YoY)">
                        <ResponsiveContainer>
                            <LineChart data={revenueComparison}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.3)"/>
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                                <YAxis tick={{ fill: '#94a3b8' }} />
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: '#4f46e5' }} />
                                <Legend />
                                <Line type="monotone" dataKey="lastYear" stroke="#10b981" strokeWidth={2} />
                                <Line type="monotone" dataKey="thisYear" stroke="#4f46e5" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>
            </div>
        </div>
    );
};

export default Reports;