
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// 1. Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Read Backup JSON
const backupPath = './backup/serendipia_backup_2026-03-11.json';
const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

async function migrate() {
    console.log('Starting migration from JSON...');

    // Mapping logic (same as in storage.ts)
    
    // Clients
    if (backupData.clients) {
        console.log('Migrating clients...');
        const { error } = await supabase.from('clients').upsert(backupData.clients.map(c => ({
            id: c.id,
            name: c.name,
            doc_id: c.docId,
            email: c.email,
            phone: c.phone,
            address: c.address
        })));
        if (error) console.error('Error clients:', error);
    }

    // Inventory
    if (backupData.inventory) {
        console.log('Migrating inventory...');
        const { error } = await supabase.from('inventory').upsert(backupData.inventory.map(i => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit
        })));
        if (error) console.error('Error inventory:', error);
    }

    // Products
    if (backupData.products) {
        console.log('Migrating products...');
        const { error } = await supabase.from('products').upsert(backupData.products.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price_usd: p.priceUSD,
            cost_usd: p.costUSD || 0,
            material_consumption: p.materials || []
        })));
        if (error) console.error('Error products:', error);
    }

    // Accounts
    if (backupData.accounts) {
        console.log('Migrating accounts...');
        const { error } = await supabase.from('accounts').upsert(backupData.accounts.map(a => ({
            id: a.id,
            name: a.name,
            balance: a.balance,
            currency: a.currency || (a.type === 'USD' ? 'USD' : 'VES'),
            method_key: a.methodKey
        })));
        if (error) console.error('Error accounts:', error);
    }

    // Transactions
    if (backupData.transactions) {
        console.log('Migrating transactions...');
        // Split into chunks to avoid large request errors
        const chunks = [];
        for (let i = 0; i < backupData.transactions.length; i += 100) {
            chunks.push(backupData.transactions.slice(i, i + 100));
        }

        for (const chunk of chunks) {
            const { error } = await supabase.from('transactions').upsert(chunk.map(t => ({
                id: t.id,
                client_id: t.clientId,
                timestamp: new Date(t.timestamp).toISOString(),
                items: t.items,
                total_usd: t.totalUSD,
                total_ves: t.totalVES,
                rate_used: t.rateUsed,
                payments: t.payments,
                debt_payments: t.debtPayments || [],
                is_paid: t.isPaid !== undefined ? t.isPaid : true
            })));
            if (error) console.error('Error transactions chunk:', error);
        }
    }

    // Expenses
    if (backupData.expenses) {
        console.log('Migrating expenses...');
        const { error } = await supabase.from('expenses').upsert(backupData.expenses.map(e => ({
            id: e.id,
            account_id: e.accountId,
            amount: e.amountPaid,
            description: e.description,
            category: e.category,
            timestamp: new Date(e.timestamp).toISOString()
        })));
        if (error) console.error('Error expenses:', error);
    }

    // Transfers
    if (backupData.transfers) {
        console.log('Migrating transfers...');
        const { error } = await supabase.from('transfers').upsert(backupData.transfers.map(t => ({
            id: t.id,
            from_account_id: t.fromAccountId,
            to_account_id: t.toAccountId,
            amount_from: t.amountFrom,
            amount_to: t.amountTo,
            timestamp: new Date(t.timestamp).toISOString()
        })));
        if (error) console.error('Error transfers:', error);
    }

    // Rates
    if (backupData.rates) {
        console.log('Migrating rates...');
        const { error } = await supabase.from('rates').upsert([{
            id: '00000000-0000-0000-0000-000000000000',
            bcv: backupData.rates.bcv,
            parallel: backupData.rates.parallel,
            selected: backupData.rates.selected
        }]);
        if (error) console.error('Error rates:', error);
    }

    // Settings
    if (backupData.settings) {
        console.log('Migrating settings...');
        const settingsArray = Object.entries(backupData.settings).map(([key, value]) => ({
            key,
            value
        }));
        const { error } = await supabase.from('settings').upsert(settingsArray);
        if (error) console.error('Error settings:', error);
    }

    console.log('Migration finished!');
}

migrate();
