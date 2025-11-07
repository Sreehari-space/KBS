
import React, { useState } from 'react';
import { Product } from '../types';
import { ICONS } from '../constants';
import { getAIcategory } from '../services/geminiService';

const emptyProduct: Product = { id: '', name: '', sku: '', stock: 0, price: 0, category: '', imageUrl: '' };

interface InventoryProps {
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    categories: string[];
    setCategories: React.Dispatch<React.SetStateAction<string[]>>;
}

const Inventory: React.FC<InventoryProps> = ({ products, setProducts, categories, setCategories }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isCategorizing, setIsCategorizing] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);

    const filteredProducts = products
        .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        .filter(p => {
            if (filter === 'All') return true;
            if (filter === 'Low Stock') return p.stock < 50;
            return p.category === filter;
        });
    
    const allCategories = ['All', 'Low Stock', ...categories];

    const handleOpenModal = (product: Product | null) => {
        setEditingProduct(product ? {...product} : {...emptyProduct, id: `PROD-${Date.now()}`});
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleSaveProduct = () => {
        if (!editingProduct) return;
        
        const productToSave = { ...editingProduct };

        setProducts(prevProducts => {
            const exists = prevProducts.some(p => p.id === productToSave.id);
            
            if (exists) {
                // Update existing product
                return prevProducts.map(p => p.id === productToSave.id ? productToSave : p);
            } else {
                // Add new product
                return [productToSave, ...prevProducts];
            }
        });
        handleCloseModal();
    };

    const handleDeleteProduct = (productId: string) => {
        setProductToDeleteId(productId);
        setShowDeleteConfirmModal(true);
    };

    const confirmDeleteProduct = () => {
        if (productToDeleteId) {
            setProducts(prevProducts => prevProducts.filter(p => p.id !== productToDeleteId));
            setShowDeleteConfirmModal(false);
            setProductToDeleteId(null);
        }
    };

    const cancelDeleteProduct = () => {
        setShowDeleteConfirmModal(false);
        setProductToDeleteId(null);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!editingProduct) return;
        const { name, value } = e.target;
        setEditingProduct({ ...editingProduct, [name]: name === 'stock' || name === 'price' ? parseFloat(value) : value });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && editingProduct) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditingProduct({ ...editingProduct, imageUrl: reader.result as string });
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleAICategorize = async () => {
        if (!editingProduct || !editingProduct.name) {
            alert("Please enter a product name first.");
            return;
        }
        setIsCategorizing(true);
        try {
            const category = await getAIcategory(editingProduct.name);
            if (category && category !== "Error") {
                setEditingProduct({ ...editingProduct, category });
                 if (!categories.includes(category)) {
                    setCategories(prev => [...prev, category]);
                }
            } else {
                alert("Could not determine a category.");
            }
        } finally {
            setIsCategorizing(false);
        }
    };
    
    const handleAddNewCategory = () => {
        const newCategoryName = window.prompt("Enter new category name:");
        if (newCategoryName && newCategoryName.trim()) {
            const trimmedName = newCategoryName.trim();
            if (!categories.includes(trimmedName)) {
                setCategories(prev => [...prev, trimmedName]);
                if(editingProduct) {
                    setEditingProduct({...editingProduct, category: trimmedName });
                }
            } else {
                alert(`Category "${trimmedName}" already exists.`);
            }
        }
    };

    const productToDelete = productToDeleteId ? products.find(p => p.id === productToDeleteId) : null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Inventory</h1>
                <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    {ICONS.Plus} Add Product
                </button>
            </div>

            <div className="bg-light-surface dark:bg-dark-surface p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4">
                <input
                    type="search"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:flex-grow pl-4 pr-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 border dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <div className="relative w-full md:w-auto md:min-w-[200px]">
                    <select 
                        value={filter} 
                        onChange={e => setFilter(e.target.value)}
                        className="w-full appearance-none px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 border dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary pr-8"
                    >
                        {allCategories.map(cat => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-light-text-secondary dark:text-dark-text-secondary">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>

            <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary">
                            <tr>
                                <th scope="col" className="px-6 py-3">Product</th>
                                <th scope="col" className="px-6 py-3">SKU</th>
                                <th scope="col" className="px-6 py-3">Stock</th>
                                <th scope="col" className="px-6 py-3">Price</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(product => (
                                <tr key={product.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <th scope="row" className="px-6 py-4 font-medium whitespace-nowrap flex items-center gap-3">
                                        <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-md object-cover" />
                                        {product.name}
                                    </th>
                                    <td className="px-6 py-4 text-light-text-secondary dark:text-dark-text-secondary">{product.sku}</td>
                                    <td className={`px-6 py-4 font-medium ${product.stock < 50 ? 'text-red-500' : ''}`}>{product.stock}</td>
                                    <td className="px-6 py-4">₹{product.price.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleOpenModal(product)} className="font-medium text-brand-primary hover:underline">Edit</button>
                                        <button onClick={() => handleDeleteProduct(product.id)} className="font-medium text-red-500 hover:underline ml-4">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && editingProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <h2 className="text-2xl font-bold mb-6">{products.some(p => p.id === editingProduct.id) ? 'Edit Product' : 'Add New Product'}</h2>
                        <div className="space-y-4">
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">Product Name</label>
                                <input type="text" name="name" value={editingProduct.name} onChange={handleFormChange} placeholder="e.g. Organic Whole Milk" className=" w-full p-2 rounded bg-slate-100 dark:bg-slate-700 border dark:border-slate-600" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">SKU</label>
                                    <input type="text" name="sku" value={editingProduct.sku} onChange={handleFormChange} placeholder="e.g. DRY-MLK-01" className="w-full p-2 rounded bg-slate-100 dark:bg-slate-700 border dark:border-slate-600" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category</label>
                                    <div className="flex items-center gap-2">
                                        <select name="category" value={editingProduct.category} onChange={handleFormChange} className="w-full p-2 rounded bg-slate-100 dark:bg-slate-700 border dark:border-slate-600">
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <button onClick={handleAddNewCategory} title="Add New Category" className="p-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">{ICONS.Plus}</button>
                                        <button onClick={handleAICategorize} disabled={isCategorizing} title="AI Categorize" className="p-2 bg-brand-primary text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                            {isCategorizing ? '...' : ICONS.Sparkles}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Stock Quantity</label>
                                    <input type="number" name="stock" value={editingProduct.stock} onChange={handleFormChange} placeholder="0" className="w-full p-2 rounded bg-slate-100 dark:bg-slate-700 border dark:border-slate-600" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Price (₹)</label>
                                    <input type="number" name="price" value={editingProduct.price} onChange={handleFormChange} placeholder="0.00" className="w-full p-2 rounded bg-slate-100 dark:bg-slate-700 border dark:border-slate-600" />
                                </div>
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">Product Image</label>
                                <div className="flex items-center gap-4 mt-2">
                                    <img src={editingProduct.imageUrl || 'https://placehold.co/80x80/e2e8f0/e2e8f0'} alt="Product preview" className="w-20 h-20 rounded-md object-cover bg-slate-200 dark:bg-slate-700" />
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20"/>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-4 mt-8">
                            <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                            <button onClick={handleSaveProduct} className="px-4 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-indigo-700">Save Product</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteConfirmModal && productToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
                        <h2 className="text-2xl font-bold mb-4">Confirm Deletion</h2>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
                            Are you sure you want to delete <span className="font-semibold text-light-text dark:text-dark-text">"{productToDelete.name}"</span>?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-center gap-4 mt-6">
                            <button onClick={cancelDeleteProduct} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                            <button onClick={confirmDeleteProduct} className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;