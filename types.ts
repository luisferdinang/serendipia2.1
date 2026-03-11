
export enum PaymentMethod {
  USD_CASH = 'Efectivo USD',
  VES_CASH = 'Efectivo Bs',
  VES_PAGO_MOVIL = 'Pago Móvil',
  USDT = 'Binance USDT',
  CREDIT = 'Fiado / Crédito'
}

export enum RateType {
  BCV = 'BCV',
  PARALLEL = 'Paralelo'
}

export type PrintMode = 'USD' | 'VES' | 'MIXED';

export interface Client {
  id: string;
  name: string;
  docId?: string; // CI or RIF
  phone?: string;
  address?: string;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string; // e.g., 'hojas', 'ml', 'unidades'
}

export interface ProductMaterial {
  inventoryId: string;
  consumption: number;
}

export interface Product {
  id: string;
  name: string;
  priceUSD: number;
  category: string;
  // Legacy fields (optional for backward compatibility)
  inventoryId?: string; 
  consumption?: number; 
  // New field for multiple materials
  materials?: ProductMaterial[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface ExchangeRates {
  bcv: number;
  parallel: number;
  selected: RateType;
}

export interface TransactionPayment {
  method: PaymentMethod;
  amount: number;
  amountInUSD: number;
  reference?: string; // New: Bank Reference
  timestamp?: number; // New: Exact time of payment (crucial for debt installments)
}

export interface Transaction {
  id: string;
  timestamp: number;
  items: CartItem[];
  totalUSD: number;
  totalVES: number;
  rateUsed: number;
  payments: TransactionPayment[];
  debtPayments?: TransactionPayment[]; // New: History of payments towards debt
  clientId?: string; // Link to Client ID
  clientName?: string; // Snapshot of name at time of sale
  clientDoc?: string; // Snapshot of CI/RIF
  isPaid?: boolean; // New: For tracking full payment status
}

// New Interface for Money Accounts
export interface Account {
  id: string;
  name: string;
  type: 'USD' | 'VES';
  balance: number;
  methodKey: PaymentMethod; // Links to PaymentMethod enum to auto-update on sales
}

export interface Expense {
  id: string;
  description: string;
  amountUSD: number; // For reporting value
  amountPaid: number; // Actual amount paid in the currency
  category: string;
  timestamp: number;
  accountId: string; // ID of the account used to pay
}

export interface DailyStats {
  totalSalesUSD: number;
  totalDebtUSD: number; // Separated debt tracking
  totalExpensesUSD: number;
  netIncomeUSD: number;
  methodBreakdown: Record<PaymentMethod, number>;
  transactionsCount: number;
  inventoryConsumed: Record<string, number>; 
}

export interface AppSettings {
  adminPin?: string; // Encrypted or plain text (simple) PIN
  storeName?: string;
  lastBackup?: number; // Timestamp of last backup
}

export interface BackupData {
  products: Product[];
  inventory: InventoryItem[];
  clients: Client[]; // Added Clients
  transactions: Transaction[];
  expenses: Expense[];
  rates: ExchangeRates;
  accounts: Account[];
  transfers: Transfer[];
  settings?: AppSettings; 
  exportDate: number;
  version: string;
}

export interface Transfer {
  id: string;
  timestamp: number;
  fromAccountId: string;
  toAccountId: string;
  amountFrom: number;
  amountTo: number;
  rateUsed?: number;
  feeAmount?: number;
  feeCurrency?: 'USD' | 'VES';
  note?: string;
}
