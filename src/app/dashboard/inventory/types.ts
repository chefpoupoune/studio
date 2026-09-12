
export const PRODUCT_FAMILIES = ["Cuisine", "Salle / Sanitaire", "Plonge", "Non classé"] as const;
export type ProductFamily = typeof PRODUCT_FAMILIES[number];

export const STORAGE_ZONES = ["Épicerie", "Congelé", "BOF"] as const;
export type StorageZone = typeof STORAGE_ZONES[number];

// New Type for Suppliers
export interface Supplier {
  id: string;
  name: string;
}

// New Type for linking products to suppliers with specific references
export interface ProductSupplierReference {
  supplierId: string;
  reference: string;
}

export interface Product {
  id: string;
  name: string;
  subNames: string[];
  supplierReferences?: ProductSupplierReference[];
  quantity: number;
  alertThreshold: number;
  unit: PurchaseOrderUnit;
  quantityPerUnit: number;
  family?: ProductFamily;
  storageZone?: StorageZone;
  archived?: boolean;
  // The 'references' field is now obsolete and replaced by supplierReferences
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
  isUnlinked?: boolean;
}

export type PurchaseOrderStatus = 'pending' | 'received';

export interface PurchaseOrder {
  id: string;
  date: Date; // Changed from Firestore Timestamp to JS Date for app use
  orderNumber: string;
  supplierId?: string; // To associate the order with a supplier
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  receivedDate?: string; // Kept as ISO string, will be parsed if needed
}
