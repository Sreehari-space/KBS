
import React, { useState } from 'react';
import { ICONS } from '../constants';

const Header: React.FC = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
  return (
    <header className="h-20 bg-light-surface dark:bg-dark-surface border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8">
      <div className="relative w-full max-w-md">
        <input
          type="search"
          placeholder="Search products, customers, orders..."
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 border border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>
      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
            {ICONS.Notification}
        </button>
        <div className="relative">
          <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center space-x-2">
            <img
              src="https://picsum.photos/id/237/40/40"
              alt="User"
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="hidden md:block text-left">
                <p className="font-semibold text-sm">Jane Doe</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Admin</p>
            </div>
          </button>
          {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-light-surface dark:bg-dark-surface rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
                  <a href="#" className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-slate-100 dark:hover:bg-slate-700">Profile</a>
                  <a href="#" className="flex items-center px-4 py-2 text-sm text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                      {ICONS.Logout} Logout
                  </a>
              </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
