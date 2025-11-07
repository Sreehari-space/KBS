
import React from 'react';
import { Screen } from '../App';
import { NAV_ITEMS } from '../constants';

interface SidebarProps {
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeScreen, setActiveScreen }) => {
  return (
    <div className="w-16 md:w-64 bg-light-surface dark:bg-dark-surface border-r border-slate-200 dark:border-slate-800 flex flex-col">
      <div className="flex items-center justify-center md:justify-start h-20 border-b border-slate-200 dark:border-slate-800 px-4">
        <svg className="h-8 w-8 text-brand-primary" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .5C5.648.5.5 5.648.5 12s5.148 11.5 11.5 11.5S23.5 18.352 23.5 12 .5zM12 21c-4.962 0-9-4.038-9-9s4.038-9 9-9 9 4.038 9 9-4.038 9-9 9z" />
          <path d="M12 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 18.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
        </svg>
        <div className="hidden md:block ml-2">
          <h1 className="text-xl font-bold">KBS</h1>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Kadai billing system</p>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.name}
            onClick={() => setActiveScreen(item.name)}
            className={`w-full flex items-center justify-center md:justify-start p-3 rounded-lg transition-colors duration-200 ${
              activeScreen === item.name
                ? 'bg-brand-primary text-white'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            {item.icon}
            <span className="hidden md:block ml-4 font-medium">{item.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;