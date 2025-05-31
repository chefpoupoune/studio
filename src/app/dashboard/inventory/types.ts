
export interface Product {
  id: string;
  name: string;
  reference: string;
  quantity: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string; 
  type: 'entry' | 'exit';
  quantity: number;
  date: Date; // Changed from Firestore Timestamp to JS Date for app use
  notes?: string;
}

export type PurchaseOrderUnit = 'Litre' | 'Piece' | 'Lot' | 'Carton';
export const PURCHASE_ORDER_UNITS: PurchaseOrderUnit[] = ['Piece', 'Litre', 'Lot', 'Carton'];


export interface PurchaseOrderItem {
  productId: string;
  productName: string; 
  reference: string; 
  quantity: number;
  unit: PurchaseOrderUnit;
}

export type PurchaseOrderStatus = 'pending' | 'received';

export interface PurchaseOrder {
  id: string;
  date: Date; // Changed from Firestore Timestamp to JS Date for app use
  orderNumber: string; 
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  receivedDate?: string; // Kept as ISO string, will be parsed if needed
}

