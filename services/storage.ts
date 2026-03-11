import { openDB, IDBPDatabase } from 'idb';
import { supabase } from './supabase';

const DB_NAME = 'SerendipiaDB';
const DB_VERSION = 3;

// Define stores
const STORES = ['products', 'inventory', 'clients', 'rates', 'transactions', 'expenses', 'accounts', 'settings', 'transfers'];

const initDB = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      });
    },
  });
};

export const saveToStorage = async <T>(key: string, data: T): Promise<void> => {
  try {
    // 1. Save to Local IndexedDB (as cache)
    const db = await initDB();
    await db.put(key, data, 'data');

    // 2. Sync to Supabase if authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (session && STORES.includes(key)) {
        // Prepare data for Supabase (handling specific mappings if needed)
        let supabaseData: any = data;
        
        // Handle mapping for specific stores (similar to migration.ts logic)
        if (key === 'products' && Array.isArray(data)) {
            supabaseData = data.map((p: any) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                price_usd: p.priceUSD,
                cost_usd: p.costUSD || 0,
                image_url: p.image,
                material_consumption: p.materials || p.materialUsage || []
            }));
        } else if (key === 'transactions' && Array.isArray(data)) {
            supabaseData = data.map((t: any) => ({
                id: t.id,
                client_id: t.clientId,
                timestamp: new Date(t.timestamp).toISOString(),
                items: t.items,
                total_usd: t.totalUSD,
                total_ves: t.totalVES,
                rate_used: t.rateUsed,
                payments: t.payments,
                debt_payments: t.debtPayments || [],
                is_paid: t.isPaid
            }));
        } else if (key === 'inventory' && Array.isArray(data)) {
            supabaseData = data.map((i: any) => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
                min_stock: i.minStock || 0
            }));
        } else if (key === 'accounts' && Array.isArray(data)) {
             supabaseData = data.map((a: any) => ({
                id: a.id,
                name: a.name,
                balance: a.balance,
                currency: a.currency,
                method_key: a.methodKey
            }));
        } else if (key === 'clients' && Array.isArray(data)) {
             supabaseData = data.map((c: any) => ({
                id: c.id,
                name: c.name,
                doc_id: c.docId,
                email: c.email,
                phone: c.phone,
                address: c.address
            }));
        } else if (key === 'expenses' && Array.isArray(data)) {
             supabaseData = data.map((e: any) => ({
                id: e.id,
                account_id: e.accountId,
                amount: e.amountPaid,
                description: e.description,
                category: e.category,
                timestamp: new Date(e.timestamp).toISOString()
            }));
        } else if (key === 'transfers' && Array.isArray(data)) {
             supabaseData = data.map((t: any) => ({
                id: t.id,
                from_account_id: t.fromAccountId,
                to_account_id: t.toAccountId,
                amount_from: t.amountFrom,
                amount_to: t.amountTo,
                timestamp: new Date(t.timestamp).toISOString()
            }));
        } else if (key === 'rates' && data) {
             supabaseData = [{
                id: '00000000-0000-0000-0000-000000000000',
                bcv: (data as any).bcv,
                parallel: (data as any).parallel,
                selected: (data as any).selected
            }];
        } else if (key === 'settings' && data) {
             supabaseData = Object.entries(data).map(([k, v]) => ({
                key: k,
                value: v
            }));
        }

        const { error } = await supabase.from(key).upsert(supabaseData);
        if (error) console.error(`Supabase sync error for ${key}:`, error);
    }
  } catch (error) {
    console.error(`Error saving to IDB key ${key}:`, error);
  }
};

export const loadFromStorage = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    // 1. Try Supabase first if authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (session && STORES.includes(key)) {
        const { data, error } = await supabase.from(key).select('*');
        if (!error && data && data.length > 0) {
            // Reconstruct data from Supabase format (reversing mapping)
            let parsedData: any = data;
            
            if (key === 'products') {
                parsedData = data.map(p => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    priceUSD: Number(p.price_usd),
                    costUSD: Number(p.cost_usd),
                    image: p.image_url,
                    materials: p.material_consumption
                }));
            } else if (key === 'transactions') {
                parsedData = data.map(t => ({
                    id: t.id,
                    clientId: t.client_id,
                    timestamp: new Date(t.timestamp || t.created_at).getTime(),
                    items: t.items,
                    totalUSD: Number(t.total_usd),
                    totalVES: Number(t.total_ves),
                    rateUsed: Number(t.rate_used),
                    payments: t.payments,
                    debtPayments: t.debt_payments,
                    isPaid: t.is_paid
                }));
            } else if (key === 'inventory') {
                parsedData = data.map(i => ({
                    id: i.id,
                    name: i.name,
                    quantity: Number(i.quantity),
                    unit: i.unit,
                    minStock: Number(i.min_stock)
                }));
            } else if (key === 'accounts') {
                parsedData = data.map(a => ({
                    id: a.id,
                    name: a.name,
                    balance: Number(a.balance),
                    currency: a.currency,
                    methodKey: a.method_key
                }));
            } else if (key === 'clients') {
                 parsedData = data.map(c => ({
                    id: c.id,
                    name: c.name,
                    docId: c.doc_id,
                    email: c.email,
                    phone: c.phone,
                    address: c.address
                }));
            } else if (key === 'expenses') {
                 parsedData = data.map(e => ({
                    id: e.id,
                    accountId: e.account_id,
                    amountPaid: Number(e.amount),
                    description: e.description,
                    category: e.category,
                    timestamp: new Date(e.timestamp || e.created_at).getTime()
                }));
            } else if (key === 'transfers') {
                 parsedData = data.map(t => ({
                    id: t.id,
                    fromAccountId: t.from_account_id,
                    toAccountId: t.to_account_id,
                    amountFrom: Number(t.amount_from),
                    amountTo: Number(t.amount_to),
                    timestamp: new Date(t.timestamp || t.created_at).getTime()
                }));
            } else if (key === 'rates') {
                 const r = data[0];
                 parsedData = {
                    bcv: Number(r.bcv),
                    parallel: Number(r.parallel),
                    selected: r.selected
                 };
            } else if (key === 'settings') {
                 parsedData = {};
                 data.forEach(s => {
                    parsedData[s.key] = s.value;
                 });
            }
            
            // Sync to local for offline use
            const db = await initDB();
            await db.put(key, parsedData, 'data');
            
            return parsedData as T;
        }
    }

    // 2. Fallback to Local IndexedDB
    const db = await initDB();
    const data = await db.get(key, 'data');
    return data !== undefined ? data : fallback;
  } catch (error) {
    console.error(`Error loading from IDB key ${key}:`, error);
    return fallback;
  }
};

export const clearStorage = async (): Promise<void> => {
   const db = await initDB();
   await Promise.all(STORES.map(store => db.clear(store)));
};

// New function to request persistent storage from the browser
export const requestPersistence = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Persisted storage granted: ${isPersisted}`);
    return isPersisted;
  }
  return false;
};
