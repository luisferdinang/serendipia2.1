import { supabase } from './supabase';
import { loadFromStorage, clearStorage } from './storage';
import { INITIAL_PRODUCTS, INITIAL_RATES, INITIAL_ACCOUNTS } from '../constants';

export const migrateDataToSupabase = async () => {
    console.log('Starting migration to Supabase...');
    
    try {
        // 1. Products
        const localProducts = await loadFromStorage('products', INITIAL_PRODUCTS);
        if (localProducts.length > 0) {
            const { error: pError } = await supabase.from('products').upsert(
                localProducts.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    price_usd: p.priceUSD,
                    cost_usd: p.costUSD || 0,
                    image_url: p.image,
                    material_consumption: p.materials || p.materialUsage || []
                }))
            );
            if (pError) console.error('Migration error (products):', pError);
        }

        // 2. Inventory
        const localInventory = await loadFromStorage('inventory', []);
        if (localInventory.length > 0) {
            const { error: iError } = await supabase.from('inventory').upsert(
                localInventory.map((i: any) => ({
                    id: i.id,
                    name: i.name,
                    quantity: i.quantity,
                    unit: i.unit,
                    min_stock: i.minStock || 0
                }))
            );
            if (iError) console.error('Migration error (inventory):', iError);
        }

        // 3. Clients
        const localClients = await loadFromStorage('clients', []);
        if (localClients.length > 0) {
            const { error: cError } = await supabase.from('clients').upsert(
                localClients.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    doc_id: c.docId,
                    email: c.email,
                    phone: c.phone,
                    address: c.address
                }))
            );
            if (cError) console.error('Migration error (clients):', cError);
        }

        // 4. Accounts
        const localAccounts = await loadFromStorage('accounts', INITIAL_ACCOUNTS);
        if (localAccounts.length > 0) {
            const { error: aError } = await supabase.from('accounts').upsert(
                localAccounts.map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    balance: a.balance,
                    currency: a.currency,
                    method_key: a.methodKey
                }))
            );
            if (aError) console.error('Migration error (accounts):', aError);
        }

        // 5. Rates
        const localRates = await loadFromStorage('rates', INITIAL_RATES);
        if (localRates) {
            const { error: rError } = await supabase.from('rates').upsert([{
                id: '00000000-0000-0000-0000-000000000000', // One record for current rates
                bcv: localRates.bcv,
                parallel: localRates.parallel,
                selected: localRates.selected
            }]);
            if (rError) console.error('Migration error (rates):', rError);
        }

        // 6. Transactions
        const localTransactions = await loadFromStorage('transactions', []);
        if (localTransactions.length > 0) {
            const { error: tError } = await supabase.from('transactions').upsert(
                localTransactions.map((t: any) => ({
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
                }))
            );
            if (tError) console.error('Migration error (transactions):', tError);
        }

        // 7. Expenses
        const localExpenses = await loadFromStorage('expenses', []);
        if (localExpenses.length > 0) {
            const { error: eError } = await supabase.from('expenses').upsert(
                localExpenses.map((e: any) => ({
                    id: e.id,
                    account_id: e.accountId,
                    amount: e.amountPaid,
                    description: e.description,
                    category: e.category,
                    timestamp: new Date(e.timestamp).toISOString()
                }))
            );
            if (eError) console.error('Migration error (expenses):', eError);
        }

        // 8. Transfers
        const localTransfers = await loadFromStorage('transfers', []);
        if (localTransfers.length > 0) {
            const { error: trError } = await supabase.from('transfers').upsert(
                localTransfers.map((t: any) => ({
                    id: t.id,
                    from_account_id: t.fromAccountId,
                    to_account_id: t.toAccountId,
                    amount_from: t.amountFrom,
                    amount_to: t.amountTo,
                    timestamp: new Date(t.timestamp).toISOString()
                }))
            );
            if (trError) console.error('Migration error (transfers):', trError);
        }

        // 9. Settings
        const localSettings = await loadFromStorage('settings', {});
        if (Object.keys(localSettings).length > 0) {
             const { error: sError } = await supabase.from('settings').upsert(
                Object.entries(localSettings).map(([key, value]) => ({
                    key,
                    value
                }))
            );
            if (sError) console.error('Migration error (settings):', sError);
        }

        console.log('Migration completed successfully.');
        return true;
    } catch (error) {
        console.error('Fatal migration error:', error);
        return false;
    }
};
