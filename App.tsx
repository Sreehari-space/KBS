import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Reports from './components/Reports';
import Settings from './components/Settings';
import { mockProducts, mockCustomers, mockSales } from './data/mockData';
import { Product, Customer, Sale as SaleType } from './types';

export type Screen = 'Dashboard' | 'Sales' | 'Inventory' | 'Customers' | 'Reports' | 'Settings';

export interface StoreInfo {
  name: string;
  address: string;
  phone: string;
}

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<Screen>('Dashboard');
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [sales, setSales] = useState<SaleType[]>(mockSales);
  const [categories, setCategories] = useState<string[]>(() => {
    return [...new Set(mockProducts.map(p => p.category))];
  });
  
  const [theme, setTheme] = useState(localStorage.getItem('pos-theme') || 'light');
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    name: 'AI Retail Store',
    address: '123 Market St, San Francisco, CA',
    phone: '555-123-4567',
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('pos-theme', theme);
  }, [theme]);


  const renderScreen = () => {
    switch (activeScreen) {
      case 'Dashboard':
        return <Dashboard sales={sales} />;
      case 'Sales':
        return <Sales 
          products={products} 
          setProducts={setProducts} 
          customers={customers} 
          addSale={(newSale) => setSales(prev => [...prev, newSale])} 
          storeInfo={storeInfo}
        />;
      case 'Inventory':
        return <Inventory 
            products={products} 
            setProducts={setProducts}
            categories={categories}
            setCategories={setCategories}
        />;
      case 'Customers':
        return <Customers customers={customers} setCustomers={setCustomers} />;
      case 'Reports':
        return <Reports />;
      case 'Settings':
        return <Settings 
          theme={theme}
          setTheme={setTheme}
          storeInfo={storeInfo}
          setStoreInfo={setStoreInfo}
        />;
      default:
        return <Dashboard sales={sales} />;
    }
  };

  return (
    <div className="flex h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
      <Sidebar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-light-bg dark:bg-dark-bg p-4 md:p-8">
          {renderScreen()}
        </main>
        <footer className="bg-light-surface dark:bg-dark-surface p-4 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary border-t border-slate-200 dark:border-slate-700">
          KBS v1.0 | Store: {storeInfo.name} | User: Admin
        </footer>
      </div>
    </div>
  );
};

export default App;