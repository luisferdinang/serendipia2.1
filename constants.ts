
import { Product, ExchangeRates, RateType, InventoryItem, Account, PaymentMethod } from './types';

export const DEFAULT_PAPER_ID = 'inv_bond_letter';

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: DEFAULT_PAPER_ID, name: 'Papel Bond (Carta)', quantity: 500, unit: 'hojas' },
  { id: 'inv_bond_legal', name: 'Papel Bond (Oficio)', quantity: 100, unit: 'hojas' },
  { id: 'inv_photo_4x6', name: 'Papel Fotográfico 4x6', quantity: 50, unit: 'hojas' },
  { id: 'inv_cartulina', name: 'Cartulina', quantity: 20, unit: 'hojas' }
];

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Copia B/N (Carta)', priceUSD: 0.10, category: 'Copias', inventoryId: DEFAULT_PAPER_ID, consumption: 1 },
  { id: '2', name: 'Copia Color (Carta)', priceUSD: 0.25, category: 'Copias', inventoryId: DEFAULT_PAPER_ID, consumption: 1 },
  { id: '3', name: 'Impresión B/N', priceUSD: 0.15, category: 'Impresión', inventoryId: DEFAULT_PAPER_ID, consumption: 1 },
  { id: '4', name: 'Impresión Color', priceUSD: 0.30, category: 'Impresión', inventoryId: DEFAULT_PAPER_ID, consumption: 1 },
  { id: '5', name: 'Fondo Negro', priceUSD: 2.00, category: 'Servicios', inventoryId: DEFAULT_PAPER_ID, consumption: 1 },
  { id: '6', name: 'Escaneo', priceUSD: 0.50, category: 'Digital', inventoryId: undefined, consumption: 0 },
  { id: '7', name: 'Trámite SAIME', priceUSD: 3.00, category: 'Gestión', inventoryId: DEFAULT_PAPER_ID, consumption: 2 },
  { id: '8', name: 'Foto Carnet (4x4)', priceUSD: 1.50, category: 'Fotografía', inventoryId: 'inv_photo_4x6', consumption: 0.25 },
];

export const INITIAL_RATES: ExchangeRates = {
  bcv: 36.50,
  parallel: 40.00,
  selected: RateType.BCV
};

export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'acc_cash_usd', name: 'Caja Fuerte (USD)', type: 'USD', balance: 0, methodKey: PaymentMethod.USD_CASH },
  { id: 'acc_cash_ves', name: 'Caja Chica (Bs)', type: 'VES', balance: 0, methodKey: PaymentMethod.VES_CASH },
  { id: 'acc_bank_ves', name: 'Banco / Pago Móvil', type: 'VES', balance: 0, methodKey: PaymentMethod.VES_PAGO_MOVIL },
  { id: 'acc_binance', name: 'Binance (USDT)', type: 'USD', balance: 0, methodKey: PaymentMethod.USDT },
];
