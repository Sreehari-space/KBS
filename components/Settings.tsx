import React from 'react';
import { StoreInfo } from '../App';

interface FormFieldProps {
    label: string;
    id: keyof StoreInfo | 'rate' | 'gstNumber';
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FormField: React.FC<FormFieldProps> = ({ label, id, type = 'text', value, onChange }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">{label}</label>
        <input 
            type={type} 
            id={id}
            name={id} 
            value={value}
            onChange={onChange}
            className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 border dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
    </div>
);

interface SettingsProps {
    theme: string;
    setTheme: (theme: string) => void;
    storeInfo: StoreInfo;
    setStoreInfo: React.Dispatch<React.SetStateAction<StoreInfo>>;
}

const Settings: React.FC<SettingsProps> = ({ theme, setTheme, storeInfo, setStoreInfo }) => {
    const [taxConfig, setTaxConfig] = React.useState({
        rate: '8.0',
        gstNumber: 'GSTIN12345678',
    });

    const handleStoreInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStoreInfo({ ...storeInfo, [e.target.id]: e.target.value });
    };

    const handleTaxConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTaxConfig({ ...taxConfig, [e.target.id]: e.target.value });
    };

    const handleThemeChange = (selectedTheme: string) => {
        setTheme(selectedTheme);
    }

    return (
        <div className="space-y-8 w-full md:max-w-4xl md:mx-auto">
            <h1 className="text-3xl font-bold">Settings</h1>

            {/* Store Info Section */}
            <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4 border-b pb-3 dark:border-slate-700">Store Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <FormField label="Store Name" id="name" value={storeInfo.name} onChange={handleStoreInfoChange} />
                    <FormField label="Phone Number" id="phone" value={storeInfo.phone} onChange={handleStoreInfoChange} />
                    <div className="md:col-span-2">
                        <FormField label="Store Address" id="address" value={storeInfo.address} onChange={handleStoreInfoChange} />
                    </div>
                </div>
            </div>

            {/* Tax Configuration Section */}
            <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4 border-b pb-3 dark:border-slate-700">Tax Configuration</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <FormField label="Default Tax Rate (%)" id="rate" type="number" value={taxConfig.rate} onChange={handleTaxConfigChange} />
                    <FormField label="GST / VAT Number" id="gstNumber" value={taxConfig.gstNumber} onChange={handleTaxConfigChange} />
                </div>
            </div>
            
            {/* Theme Customization Section */}
            <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4 border-b pb-3 dark:border-slate-700">Theme Customization</h2>
                 <div className="mt-4">
                    <p className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">Appearance</p>
                    <div className="flex gap-4">
                        <button onClick={() => handleThemeChange('light')} className={`px-6 py-2 rounded-lg border-2 font-semibold ${theme === 'light' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-slate-300 dark:border-slate-600'}`}>Light</button>
                        <button onClick={() => handleThemeChange('dark')} className={`px-6 py-2 rounded-lg border-2 font-semibold ${theme === 'dark' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-slate-300 dark:border-slate-600'}`}>Dark</button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default Settings;