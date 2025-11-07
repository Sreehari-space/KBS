import React, { useState, useMemo } from 'react';
import { Customer } from '../types';
import { ICONS } from '../constants';

const emptyCustomer: Omit<Customer, 'id'> = { name: '', phone: '', email: '', totalOrders: 0, loyaltyPoints: 0, lastSeen: 'New' };

interface CustomersProps {
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const Customers: React.FC<CustomersProps> = ({ customers, setCustomers }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [filter, setFilter] = useState('All');

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            if (filter === 'All') return true;
            if (filter === 'Frequent Buyer') return c.lastSeen === 'Frequent Buyer';
            if (filter === 'Inactive 30+ Days') return c.lastSeen === 'Inactive 30+ Days';
            return true;
        });
    }, [customers, filter]);

    const handleOpenModal = (customer: Customer | null) => {
        setEditingCustomer(customer ? {...customer} : { ...emptyCustomer, id: `CUST-${Date.now()}` });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleSaveCustomer = () => {
        if (!editingCustomer) return;
        const exists = customers.some(c => c.id === editingCustomer.id);
        if (exists) {
            setCustomers(customers.map(c => c.id === editingCustomer.id ? editingCustomer : c));
        } else {
            setCustomers([...customers, editingCustomer]);
        }
        handleCloseModal();
    };

    const handleDeleteCustomer = (customerId: string) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            setCustomers(customers.filter(c => c.id !== customerId));
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingCustomer) return;
        const { name, value } = e.target;
        setEditingCustomer({ ...editingCustomer, [name]: value });
    };

    const getStatusChip = (status: string) => {
        let bgColor = 'bg-slate-200 dark:bg-slate-700';
        let textColor = 'text-slate-800 dark:text-slate-200';
    
        if (status.includes('Frequent')) {
            bgColor = 'bg-green-100 dark:bg-green-900';
            textColor = 'text-green-800 dark:text-green-200';
        } else if (status.includes('Inactive')) {
            bgColor = 'bg-amber-100 dark:bg-amber-900';
            textColor = 'text-amber-800 dark:text-amber-200';
        } else if (status.includes('ago')) {
             bgColor = 'bg-blue-100 dark:bg-blue-900';
             textColor = 'text-blue-800 dark:text-blue-200';
        }
    
        return (
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${bgColor} ${textColor}`}>
                {status}
            </span>
        );
    };


    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Customers</h1>
                <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    {ICONS.Plus} Add Customer
                </button>
            </div>
            
             <div className="bg-light-surface dark:bg-dark-surface p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex gap-2 items-center overflow-x-auto pb-2">
                    {['All', 'Frequent Buyer', 'Inactive 30+ Days'].map(cat => (
                        <button 
                          key={cat} 
                          onClick={() => setFilter(cat)}
                          className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${filter === cat ? 'bg-brand-primary text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                        >
                          {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary">
                            <tr>
                                <th scope="col" className="px-6 py-3">Name</th>
                                <th scope="col" className="px-6 py-3">Contact</th>
                                <th scope="col" className="px-6 py-3">Total Orders</th>
                                <th scope="col" className="px-6 py-3">Loyalty Points</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map(customer => (
                                <tr key={customer.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <th scope="row" className="px-6 py-4 font-medium whitespace-nowrap">
                                        {customer.name}
                                    </th>
                                    <td className="px-6 py-4">
                                        <div>{customer.phone}</div>
                                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{customer.email}</div>
                                    </td>
                                    <td className="px-6 py-4">{customer.totalOrders}</td>
                                    <td className="px-6 py-4">{customer.loyaltyPoints}</td>
                                    <td className="px-6 py-4">
                                        {getStatusChip(customer.lastSeen)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleOpenModal(customer)} className="font-medium text-brand-primary hover:underline">Edit</button>
                                        <button onClick={() => handleDeleteCustomer(customer.id)} className="font-medium text-red-500 hover:underline ml-4">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && editingCustomer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <h2 className="text-2xl font-bold mb-4">{customers.some(c => c.id === editingCustomer.id) ? 'Edit Customer' : 'Add New Customer'}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <input type="text" name="name" value={editingCustomer.name} onChange={handleFormChange} placeholder="Full Name" className="w-full p-2 rounded bg-slate-100 dark:bg-slate-700 border dark:border-slate-600" />
                             <input type="text" name="phone" value={editingCustomer.phone} onChange={handleFormChange} placeholder="Phone Number" className="w-full p-2 rounded bg-slate-100 dark:bg-slate-700 border dark:border-slate-600" />
                             <input type="email" name="email" value={editingCustomer.email} onChange={handleFormChange} placeholder="Email Address" className="md:col-span-2 w-full p-2 rounded bg-slate-100 dark:bg-slate-700 border dark:border-slate-600" />
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button>
                            <button onClick={handleSaveCustomer} className="px-4 py-2 bg-brand-primary text-white rounded-lg">Save Customer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;