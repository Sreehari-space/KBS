export interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  category: string;
  imageUrl: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalOrders: number;
  loyaltyPoints: number;
  lastSeen: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export enum PaymentMethod {
  Cash = 'Cash',
  Card = 'Card',
  UPI = 'UPI',
  QRCode = 'QR Code'
}

export interface Sale {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  customer: Customer;
  paymentMethod: PaymentMethod;
}