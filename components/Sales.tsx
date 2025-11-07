import React, { useState, useMemo } from 'react';
import { Product, CartItem, PaymentMethod, Customer, Sale } from '../types';
import { ICONS } from '../constants';
import { mockCustomers } from '../data/mockData';
import { StoreInfo } from '../App';

const ProductCard: React.FC<{ product: Product; onAddToCart: (product: Product) => void; }> = ({ product, onAddToCart }) => {
    const isOutOfStock = product.stock <= 0;
    return (
        <div 
            className={`bg-light-surface dark:bg-dark-surface rounded-lg shadow-sm overflow-hidden flex flex-col ${isOutOfStock ? 'opacity-50' : 'cursor-pointer'}`}
            onClick={() => !isOutOfStock && onAddToCart(product)}
        >
            <div className="relative">
                <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover" />
                {isOutOfStock && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">OUT OF STOCK</div>}
            </div>
            <div className="p-3 flex-1 flex flex-col justify-between">
                <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
                <div className="flex justify-between items-center mt-2">
                    <span className={`text-xs ${product.stock < 10 ? 'text-red-500 font-semibold' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{product.stock} in stock</span>
                    <span className="font-bold text-brand-primary">₹{product.price.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
};

interface SalesProps {
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    customers: Customer[];
    addSale: (newSale: Sale) => void;
    storeInfo: StoreInfo;
}

const Sales: React.FC<SalesProps> = ({ products, setProducts, customers, addSale, storeInfo }) => {
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Card);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastSale, setLastSale] = useState<Sale | null>(null);
    const [showQRCodeModal, setShowQRCodeModal] = useState(false);

    const filteredProducts = useMemo(() => {
        return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
    }, [search, products]);

    const addToCart = (product: Product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < product.stock) {
                    return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                }
                return prevCart;
            }
            if (product.stock > 0) {
                 return [...prevCart, { ...product, quantity: 1 }];
            }
            return prevCart;
        });
    };
    
    const updateQuantity = (productId: string, amount: number) => {
        setCart(prevCart => {
            const productInStock = products.find(p => p.id === productId);
            if (!productInStock) return prevCart;

            return prevCart.map(item => {
                if (item.id === productId) {
                    const newQuantity = item.quantity + amount;
                     if (newQuantity > 0 && newQuantity <= productInStock.stock) {
                        return { ...item, quantity: newQuantity };
                    }
                    if (newQuantity <= 0) {
                        return null;
                    }
                }
                return item;
            }).filter((item): item is CartItem => item !== null);
        });
    };
    
    const removeFromCart = (productId: string) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
    };
    
    const subtotal = useMemo(() => cart.reduce((acc, item) => acc + item.price * item.quantity, 0), [cart]);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    const processSale = () => {
        const newSale: Sale = {
            id: `ORD-${Date.now()}`,
            date: new Date().toISOString(),
            items: cart,
            total: total,
            customer: mockCustomers[0], // Default customer for now
            paymentMethod: paymentMethod,
        };

        // Update product stock
        setProducts(prevProducts => {
            return prevProducts.map(p => {
                const itemInCart = cart.find(item => item.id === p.id);
                if (itemInCart) {
                    return { ...p, stock: p.stock - itemInCart.quantity };
                }
                return p;
            });
        });

        addSale(newSale);
        setLastSale(newSale);
        setShowReceiptModal(true);
        setShowQRCodeModal(false);
        setCart([]);
    };

    const handleCompleteSale = () => {
        if (paymentMethod === PaymentMethod.QRCode) {
            setShowQRCodeModal(true);
        } else {
            processSale();
        }
    };

    const generateBillText = (sale: Sale) => {
        let bill = `************************\n`;
        bill += `   ${storeInfo.name.toUpperCase()}   \n`;
        bill += `************************\n`;
        bill += `Order ID: ${sale.id}\n`;
        bill += `Date: ${new Date(sale.date).toLocaleString()}\n`;
        bill += `Customer: ${sale.customer.name}\n`;
        bill += `Payment Method: ${sale.paymentMethod}\n`;
        bill += `------------------------\n`;
        bill += `Items:\n`;
        sale.items.forEach(item => {
            const itemTotal = (item.price * item.quantity).toFixed(2);
            bill += `${item.name} (x${item.quantity}) - ₹${itemTotal}\n`;
        });
        bill += `------------------------\n`;
        bill += `Subtotal: ₹${(sale.total / 1.08).toFixed(2)}\n`;
        bill += `Tax (8%): ₹${(sale.total - (sale.total / 1.08)).toFixed(2)}\n`;
        bill += `************************\n`;
        bill += `TOTAL: ₹${sale.total.toFixed(2)}\n`;
        bill += `************************\n`;
        bill += ` Thank you for your purchase! \n`;
        return bill;
    }

    const handlePrint = () => {
        const printableArea = document.getElementById('printable-receipt');
        if (printableArea) {
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow?.document.write('<html><head><title>Print Receipt</title>');
            printWindow?.document.write('<style>body{font-family:monospace; margin: 20px;} table{width:100%; border-collapse:collapse;} td,th{padding:5px; border-bottom: 1px solid #ccc; text-align:left;} .total{font-weight:bold;} h2, p {color: #000;}</style>');
            printWindow?.document.write('</head><body>');
            printWindow?.document.write(printableArea.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            printWindow?.focus();
            printWindow?.print();
        }
    };
    
    const handleDownload = () => {
        if (!lastSale) return;
        const billContent = generateBillText(lastSale);
        const element = document.createElement("a");
        const file = new Blob([billContent], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `receipt-${lastSale.id}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6">
            {/* Left Section: Product Grid */}
            <div className="flex-1 flex flex-col">
                <div className="mb-4 flex flex-col sm:flex-row gap-4">
                    <input
                        type="search"
                        placeholder="Search by name, SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-4 pr-4 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                     <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-brand-secondary text-white rounded-lg hover:bg-green-600 transition-colors">
                        {ICONS.Barcode}
                        <span className="hidden md:inline">Scan</span>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
                </div>
            </div>

            {/* Right Section: Cart */}
            <div className="w-full lg:w-96 bg-light-surface dark:bg-dark-surface rounded-xl shadow-lg flex flex-col p-6">
                <div className="flex-1 flex flex-col overflow-y-hidden">
                    <h2 className="text-2xl font-bold border-b pb-4 dark:border-slate-700 flex-shrink-0">Current Order</h2>
                    <div className="overflow-y-auto my-4 -mx-6 px-6">
                        {cart.length === 0 ? (
                            <p className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10">Your cart is empty.</p>
                        ) : (
                            <div className="space-y-4">
                                {cart.map(item => (
                                    <div key={item.id} className="flex items-center">
                                        <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-md object-cover mr-4" />
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{item.name}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">₹{item.price.toFixed(2)}</p>
                                            <div className="flex items-center mt-1">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500">{ICONS.Minus}</button>
                                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500">{ICONS.Plus}</button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">₹{(item.price * item.quantity).toFixed(2)}</p>
                                            <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 mt-2">{ICONS.Trash}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>


                <div className="border-t pt-4 space-y-2 dark:border-slate-700">
                    <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Tax (8%)</span><span>₹{tax.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-lg"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                </div>
                
                <div className="mt-4">
                    <h3 className="font-semibold mb-2">Payment Method</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.values(PaymentMethod).map(method => (
                             <button key={method} onClick={() => setPaymentMethod(method)} className={`py-2 text-sm rounded-lg border-2 transition-colors ${paymentMethod === method ? 'bg-brand-primary text-white border-brand-primary' : 'bg-transparent border-slate-300 dark:border-slate-600 hover:border-brand-primary'}`}>{method}</button>
                        ))}
                    </div>
                </div>

                <button onClick={handleCompleteSale} className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50" disabled={cart.length === 0}>
                    Complete Sale
                </button>
            </div>
            
            {/* Receipt Modal */}
            {showReceiptModal && lastSale && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
                    <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-sm p-6 text-light-text dark:text-dark-text">
                        <div id="printable-receipt" className="printable-receipt">
                             <h2 className="text-center text-2xl font-bold mb-2">{storeInfo.name}</h2>
                            <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">Sale Receipt</p>
                            <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary space-y-1 mb-4">
                                <p>Order ID: {lastSale.id}</p>
                                <p>Date: {new Date(lastSale.date).toLocaleString()}</p>
                            </div>
                            <div className="my-4 border-t border-dashed dark:border-slate-700"></div>
                            {lastSale.items.map(item => (
                                <div key={item.id} className="flex justify-between items-center text-sm mb-1">
                                    <div>
                                        <p>{item.name}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">({item.quantity} x ₹{item.price.toFixed(2)})</p>
                                    </div>
                                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="my-4 border-t border-dashed dark:border-slate-700"></div>
                            <div className="space-y-1 font-medium">
                                <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{(lastSale.total/1.08).toFixed(2)}</span></div>
                                <div className="flex justify-between text-sm"><span>Tax (8%)</span><span>₹{(lastSale.total - (lastSale.total/1.08)).toFixed(2)}</span></div>
                                <div className="flex justify-between text-lg font-bold mt-2"><span>Total</span><span>₹{lastSale.total.toFixed(2)}</span></div>
                            </div>
                             <p className="text-center text-xs mt-6 text-light-text-secondary dark:text-dark-text-secondary">Thank you for your purchase!</p>
                        </div>
                        <div className="mt-6 flex gap-4">
                            <button onClick={handlePrint} className="flex-1 py-2 px-4 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Print Bill</button>
                            <button onClick={handleDownload} className="flex-1 py-2 px-4 bg-brand-secondary text-white rounded-lg hover:bg-green-600">Download Bill</button>
                        </div>
                         <button onClick={() => setShowReceiptModal(false)} className="w-full mt-4 py-2 px-4 bg-brand-primary text-white rounded-lg hover:bg-indigo-700">New Sale</button>
                    </div>
                </div>
            )}
            
            {/* QR Code Modal */}
            {showQRCodeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-sm p-8 text-center">
                        <h2 className="text-2xl font-bold mb-2">Scan to Pay</h2>
                        <p className="text-lg font-semibold text-brand-primary mb-4">Total: ₹{total.toFixed(2)}</p>
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=user@okbank&pn=AI-Store&am=${total.toFixed(2)}&cu=INR`}
                            alt="Payment QR Code"
                            className="w-48 h-48 mx-auto rounded-lg"
                        />
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-4">Show this QR code to the customer to complete the payment via any UPI app.</p>
                        <div className="mt-6 flex flex-col gap-3">
                            <button onClick={processSale} className="w-full py-3 bg-brand-secondary text-white font-bold rounded-lg hover:bg-green-600">
                                Payment Received
                            </button>
                            <button onClick={() => setShowQRCodeModal(false)} className="w-full py-2 bg-slate-200 dark:bg-slate-600 font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sales;