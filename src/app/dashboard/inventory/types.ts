
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
  date: Date;
  notes?: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string; 
  reference: string; 
  quantity: number;
}

export interface PurchaseOrder {
  id: string;
  date: Date;
  orderNumber: string; 
  items: PurchaseOrderItem[];
  // status: 'pending' | 'generated' | 'sent'; // Future enhancement
}
