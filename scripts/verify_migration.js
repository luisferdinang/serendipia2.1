
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
    const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: transCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
    
    console.log(`Verification:`);
    console.log(`Products: ${prodCount}`);
    console.log(`Transactions: ${transCount}`);
}

verify();
