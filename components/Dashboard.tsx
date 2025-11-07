import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sale } from '../types';
import { ICONS } from '../constants';

// Expanded sales data for simulation up to 30 days
const extendedSalesData = [
  { name: 'Day 1', sales: 4000 }, { name: 'Day 2', sales: 3000 }, { name: 'Day 3', sales: 2000 },
  { name: 'Day 4', sales: 2780 }, { name: 'Day 5', sales: 1890 }, { name: 'Day 6', sales: 2390 },
  { name: 'Day 7', sales: 3490 },
  { name: 'Day 8', sales: 4100 }, { name: 'Day 9', sales: 3200 }, { name: 'Day 10', sales: 2100 },
  { name: 'Day 11', sales: 2880 }, { name: 'Day 12', sales: 1990 }, { name: 'Day 13', sales: 2490 },
  { name: 'Day 14', sales: 3590 },
  { name: 'Day 15', sales: 4300 }, { name: 'Day 16', sales: 3400 }, { name: 'Day 17', sales: 2300 },
  { name: 'Day 18', sales: 2980 }, { name: 'Day 19', sales: 2090 }, { name: 'Day 20', sales: 2590 },
  { name: 'Day 21', sales: 3690 },
  { name: 'Day 22', sales: 4400 }, { name: 'Day 23', sales: 3500 }, { name: 'Day 24', sales: 2400 },
  { name: 'Day 25', sales: 3080 }, { name: 'Day 26', sales: 2190 }, { name: 'Day 27', sales: 2690 },
  { name: 'Day 28', sales: 3790 },
  { name: 'Day 29', sales: 4500 }, { name: 'Day 30', sales: 3600 },
];

const InfoCard: React.FC<{ title: string; value: string; change: string; changeType: 'increase' | 'decrease' }> = ({ title, value, change, changeType }) => {
    const isIncrease = changeType === 'increase';
    return (
        <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-xl shadow-sm">
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
            <p className="text-3xl font-bold my-2">{value}</p>
            <div className="flex items-center text-sm">
                <span className={`flex items-center font-semibold ${isIncrease ? 'text-green-500' : 'text-red-500'}`}>
                    {isIncrease ? '▲' : '▼'} {change}
                </span>
                <span className="ml-2 text-light-text-secondary dark:text-dark-text-secondary">vs last week</span>
            </div>
        </div>
    )
};

interface DashboardProps {
    sales: Sale[];
}

const Dashboard: React.FC<DashboardProps> = ({ sales }) => {
  const [dateRange, setDateRange] = useState(7); // New state for date range

  const getFilteredSalesData = () => {
      // In a real app, this would filter actual sales data based on dates.
      // Here, we just slice the mock data to simulate.
      if (dateRange === 30) return extendedSalesData.slice(0, 30);
      if (dateRange === 15) return extendedSalesData.slice(0, 15);
      return extendedSalesData.slice(0, 7); // Default to 7 days
  };

  const handleDownloadReport = () => {
    if (!sales.length) {
        alert("No sales data to export.");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "OrderID,Date,Customer,Total,PaymentMethod,Items\n";

    sales.forEach(sale => {
        const items = sale.items.map(i => `${i.name} (x${i.quantity})`).join('; ');
        const row = [sale.id, `"${new Date(sale.date).toLocaleString()}"`, sale.customer.name, sale.total.toFixed(2), sale.paymentMethod, `"${items}"`].join(',');
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button onClick={handleDownloadReport} className="flex items-center gap-2 px-4 py-2 bg-brand-secondary text-white rounded-lg hover:bg-green-600 transition-colors self-start md:self-auto">
            {ICONS.Download} Download Report
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <InfoCard title="Total Sales Today" value="₹12,250" change="12%" changeType="increase" />
        <InfoCard title="Top Product" value="Sourdough Bread" change="5 units" changeType="increase" />
        <InfoCard title="Low Stock Alerts" value="3 Items" change="1 new" changeType="decrease" />
        <InfoCard title="New Customers" value="8" change="2" changeType="increase" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-light-surface dark:bg-dark-surface p-6 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Revenue (Last {dateRange} Days)</h2>
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
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={getFilteredSalesData()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.3)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(79, 70, 229, 0.1)'}}
                  contentStyle={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.9)', 
                    borderColor: '#4f46e5',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <ul className="space-y-4">
            <li className="flex items-center">
              <img src="https://picsum.photos/id/1005/32/32" className="h-8 w-8 rounded-full mr-3" />
              <div>
                <p className="text-sm font-medium">Sale #1024 completed</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">2 minutes ago</p>
              </div>
            </li>
            <li className="flex items-center">
              <img src="https://picsum.photos/id/1011/32/32" className="h-8 w-8 rounded-full mr-3" />
              <div>
                <p className="text-sm font-medium">New customer added: Bob W.</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">15 minutes ago</p>
              </div>
            </li>
            <li className="flex items-center">
              <img src="https://picsum.photos/id/1012/32/32" className="h-8 w-8 rounded-full mr-3" />
              <div>
                <p className="text-sm font-medium">Inventory updated for 5 items</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">1 hour ago</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;