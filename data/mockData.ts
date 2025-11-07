
// Fix: Import PaymentMethod enum to be used in mockSales.
import { Product, Customer, Sale, PaymentMethod } from '../types';

export const mockProducts: Product[] = [
  { id: '1', name: 'Organic Bananas', sku: 'FRT-BNN-01', stock: 150, price: 0.59, category: 'Fruits', imageUrl: 'https://picsum.photos/id/1080/200/200' },
  { id: '2', name: 'Whole Milk, 1 Gallon', sku: 'DRY-MLK-01', stock: 80, price: 3.49, category: 'Dairy', imageUrl: 'https://picsum.photos/id/102/200/200' },
  { id: '3', name: 'Artisan Sourdough Bread', sku: 'BKY-BRD-01', stock: 45, price: 4.99, category: 'Bakery', imageUrl: 'https://picsum.photos/id/20/200/200' },
  { id: '4', name: 'Cage-Free Large Eggs', sku: 'DRY-EGG-01', stock: 120, price: 3.99, category: 'Dairy', imageUrl: 'https://picsum.photos/id/488/200/200' },
  { id: '5', name: 'Avocado Hass', sku: 'FRT-AVC-01', stock: 200, price: 1.99, category: 'Fruits', imageUrl: 'https://picsum.photos/id/1015/200/200' },
  { id: '6', name: 'Chicken Breast, 1 lb', sku: 'MT-CHK-01', stock: 60, price: 5.99, category: 'Meat', imageUrl: 'https://picsum.photos/id/1069/200/200' },
  { id: '7', name: 'Cheddar Cheese Block', sku: 'DRY-CHS-01', stock: 75, price: 6.49, category: 'Dairy', imageUrl: 'https://picsum.photos/id/312/200/200' },
  { id: '8', name: 'Roma Tomatoes, 1 lb', sku: 'VEG-TMT-01', stock: 90, price: 2.29, category: 'Vegetables', imageUrl: 'https://picsum.photos/id/1016/200/200' },
  { id: '9', name: 'Ground Coffee, Medium Roast', sku: 'PNT-CFE-01', stock: 55, price: 12.99, category: 'Pantry', imageUrl: 'https://picsum.photos/id/30/200/200' },
  { id: '10', name: 'Spring Water, 24-pack', sku: 'BVG-WTR-01', stock: 100, price: 4.99, category: 'Beverages', imageUrl: 'https://picsum.photos/id/119/200/200' },
  { id: '11', name: 'Greek Yogurt, Plain', sku: 'DRY-YGT-01', stock: 85, price: 1.29, category: 'Dairy', imageUrl: 'https://picsum.photos/id/219/200/200' },
  { id: '12', name: 'Organic Baby Spinach', sku: 'VEG-SPN-01', stock: 70, price: 3.79, category: 'Vegetables', imageUrl: 'https://picsum.photos/id/225/200/200' },
];

export const mockCustomers: Customer[] = [
  { id: '1', name: 'Alice Johnson', phone: '555-0101', email: 'alice.j@example.com', totalOrders: 12, loyaltyPoints: 1250, lastSeen: '3 days ago' },
  { id: '2', name: 'Bob Williams', phone: '555-0102', email: 'bob.w@example.com', totalOrders: 5, loyaltyPoints: 480, lastSeen: '1 day ago' },
  { id: '3', name: 'Charlie Brown', phone: '555-0103', email: 'charlie.b@example.com', totalOrders: 25, loyaltyPoints: 3200, lastSeen: 'Frequent Buyer' },
  { id: '4', name: 'Diana Miller', phone: '555-0104', email: 'diana.m@example.com', totalOrders: 2, loyaltyPoints: 150, lastSeen: 'Inactive 30+ Days' },
  { id: '5', name: 'Ethan Davis', phone: '555-0105', email: 'ethan.d@example.com', totalOrders: 8, loyaltyPoints: 950, lastSeen: '1 week ago' },
];

export const mockSales: Sale[] = [
  {
    id: 'ORD-001',
    date: '2023-10-27T10:00:00Z',
    items: [
      { ...mockProducts[1], quantity: 1 },
      { ...mockProducts[2], quantity: 2 },
    ],
    total: 13.47,
    customer: mockCustomers[0],
    // Fix: Added missing paymentMethod property.
    paymentMethod: PaymentMethod.Card,
  },
  {
    id: 'ORD-002',
    date: '2023-10-27T10:15:00Z',
    items: [{ ...mockProducts[4], quantity: 1 }],
    total: 1.99,
    customer: mockCustomers[1],
    // Fix: Added missing paymentMethod property.
    paymentMethod: PaymentMethod.Cash,
  },
];
