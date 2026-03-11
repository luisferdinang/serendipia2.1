import React, { useState, useEffect, useMemo } from 'react';
import { 
  Product, CartItem, ExchangeRates, RateType, InventoryItem, 
  Transaction, DailyStats, PaymentMethod, Expense, BackupData, Account, Client, TransactionPayment, AppSettings, PrintMode, Transfer
} from './types';
import { INITIAL_PRODUCTS, INITIAL_RATES, INITIAL_INVENTORY, DEFAULT_PAPER_ID, INITIAL_ACCOUNTS } from './constants';
import { saveToStorage, loadFromStorage, requestPersistence } from './services/storage';
import { CheckoutModal } from './components/CheckoutModal';
import { DashboardModal } from './components/StatsModal';
import { ProductManager } from './components/ProductManager';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { Receipt } from './components/Receipt';
import { PinModal } from './components/PinModal';
import { Plus, Minus, Trash2, Settings, BarChart2, RefreshCw, Package, Check, Edit, Save, X, DownloadCloud, Moon, Sun, Loader2, AlertTriangle, Search, ShoppingCart, ArrowRight, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from './services/auth';
import { Login } from './components/Login';
import { migrateDataToSupabase } from './services/migration';
import { supabase } from './services/supabase';

interface CartItemRowProps {
  item: CartItem;
  activeRate: number;
  updateQuantity: (id: string, delta: number) => void;
  setItemQuantity: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  updatePrice: (id: string, newPrice: number) => void;
}

// --- Helper Component for Cart Row ---
const CartItemRow: React.FC<CartItemRowProps> = ({ 
  item, 
  activeRate, 
  updateQuantity, 
  setItemQuantity, 
  removeFromCart, 
  updatePrice 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localUSD, setLocalUSD] = useState(item.priceUSD.toString());
  const [localBS, setLocalBS] = useState((item.priceUSD * activeRate).toFixed(2));

  // Sync when rate or item price changes externally (if not editing)
  useEffect(() => {
    if (!isEditing) {
      setLocalUSD(item.priceUSD.toString());
      setLocalBS((item.priceUSD * activeRate).toFixed(2));
    }
  }, [item.priceUSD, activeRate, isEditing]);

  const handleUSDChange = (val: string) => {
    setLocalUSD(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setLocalBS((num * activeRate).toFixed(2));
    } else {
      setLocalBS('');
    }
  };

  const handleBSChange = (val: string) => {
    setLocalBS(val); // Mantener el valor exacto que escribe el usuario
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setLocalUSD((num / activeRate).toFixed(6));
    } else {
      setLocalUSD('');
    }
  };

  const savePrice = () => {
    const num = parseFloat(localUSD);
    if (!isNaN(num) && num >= 0) {
      updatePrice(item.id, num);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') savePrice();
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 rounded shadow-sm transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-800 dark:text-gray-100 leading-tight">{item.name}</span>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)} 
                className="text-gray-400 hover:text-blue-500 transition-colors p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                title="Editar precio"
              >
                <Edit size={12} />
              </button>
            )}
          </div>
          
          {!isEditing ? (
             <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">${item.priceUSD.toFixed(2)} / u</p>
          ) : (
            <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-700 p-2 rounded border border-blue-100 dark:border-gray-600">
               <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 dark:text-gray-300 font-bold">USD</span>
                  <input 
                    className="w-16 border rounded text-xs p-1 focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-600" 
                    value={localUSD} 
                    onChange={e => handleUSDChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => e.target.select()}
                    type="number"
                    step="0.01"
                    autoFocus
                  />
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 dark:text-gray-300 font-bold">Bs</span>
                  <input 
                    className="w-20 border rounded text-xs p-1 focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-600" 
                    value={localBS}
                    onChange={e => handleBSChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => e.target.select()}
                    type="number"
                    step="0.01"
                  />
               </div>
               <button onClick={savePrice} className="text-white bg-green-500 hover:bg-green-600 p-1 rounded transition-colors h-7 w-7 flex items-center justify-center shadow-sm">
                 <Check size={14} />
               </button>
            </div>
          )}
        </div>
        
        {/* Total Display */}
        <div className="text-right pl-2">
           {!isEditing ? (
             <>
               <div className="font-bold text-sm text-gray-900 dark:text-white">${(item.priceUSD * item.quantity).toFixed(2)}</div>
               <div className="text-[10px] text-gray-400 dark:text-gray-500">Bs.{(item.priceUSD * item.quantity * activeRate).toFixed(2)}</div>
             </>
           ) : (
             <div className="text-[10px] text-gray-400 italic mt-2">Editando...</div>
           )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50 dark:border-gray-700">
          <div className="flex items-center border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 overflow-hidden">
              <button 
                onClick={() => updateQuantity(item.id, -1)} 
                className="p-2 hover:bg-white dark:hover:bg-gray-600 hover:text-red-500 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <Minus size={14}/>
              </button>
              
              <input 
                type="number" 
                className="w-12 text-center bg-transparent outline-none border-none text-sm font-medium text-gray-800 dark:text-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 h-full"
                value={item.quantity}
                onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) setItemQuantity(item.id, val);
                }}
                onFocus={(e) => e.target.select()}
                min="1"
              />
              
              <button 
                onClick={() => updateQuantity(item.id, 1)} 
                className="p-2 hover:bg-white dark:hover:bg-gray-600 hover:text-green-500 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <Plus size={14}/>
              </button>
          </div>
          <button 
            onClick={() => removeFromCart(item.id)} 
            className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded transition-all"
            title="Eliminar del carrito"
          >
              <Trash2 size={16} />
          </button>
      </div>
    </div>
  )
};

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  
  // State
  const [isReady, setIsReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [rates, setRates] = useState<ExchangeRates>(INITIAL_RATES);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  
  // Mobile UI States
  const [mobileView, setMobileView] = useState<'landing' | 'pos'>('landing');
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loadingRate, setLoadingRate] = useState(false);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Modals
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isProductManagerOpen, setIsProductManagerOpen] = useState(false);
  const [productToEditId, setProductToEditId] = useState<string | null>(null);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [quickEditPrice, setQuickEditPrice] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showRateEdit, setShowRateEdit] = useState(false);
  
  // PIN Security State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  // Receipt State
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const [receiptDebtPayment, setReceiptDebtPayment] = useState<any | null>(null); 
  const [receiptPrintMode, setReceiptPrintMode] = useState<PrintMode>('MIXED');
  
  // Dashboard Specifics
  const [dashboardInitialClient, setDashboardInitialClient] = useState<Client | null>(null);

  // Backup Warning State
  const [needsBackup, setNeedsBackup] = useState(false);

  // Initialize Data (ASYNC)
  useEffect(() => {
    const initApp = async () => {
        // Request Persistent Storage immediately
        await requestPersistence();

        // Theme
        const savedTheme = localStorage.getItem('theme');
        const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setIsDarkMode(isDark);
        if (isDark) document.documentElement.classList.add('dark');

        // Load Data from IndexedDB
        const loadedProducts = await loadFromStorage('products', INITIAL_PRODUCTS);
        const loadedInventory = await loadFromStorage('inventory', INITIAL_INVENTORY);
        const loadedRates = await loadFromStorage('rates', INITIAL_RATES);
        const loadedTransactions = await loadFromStorage('transactions', []);
        const loadedExpenses = await loadFromStorage('expenses', []);
        const loadedTransfers = await loadFromStorage('transfers', []);
        const loadedAccounts = await loadFromStorage('accounts', INITIAL_ACCOUNTS);
        const loadedClients = await loadFromStorage('clients', []);
        const loadedSettings = await loadFromStorage<AppSettings>('settings', {});

        setProducts(loadedProducts);
        setInventory(loadedInventory);
        setRates(loadedRates);
        setTransactions(loadedTransactions);
        setExpenses(loadedExpenses);
        setTransfers(loadedTransfers);
        setAccounts(loadedAccounts);
        setClients(loadedClients);
        setSettings(loadedSettings);
        
        // Check Backup Status (If older than 3 days or never done)
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        if (!loadedSettings.lastBackup || (Date.now() - loadedSettings.lastBackup > THREE_DAYS)) {
            // Only warn if there is actually data to lose
            if (loadedTransactions.length > 0 || loadedProducts.length > INITIAL_PRODUCTS.length) {
                setNeedsBackup(true);
            }
        }

        setIsReady(true);
        fetchBCVRate();

        // Optional: Trigger migration if this is the first time (could be controlled by a setting)
        const hasMigrated = localStorage.getItem('supabase_migrated');
        if (!hasMigrated && user) {
            const success = await migrateDataToSupabase();
            if (success) localStorage.setItem('supabase_migrated', 'true');
        }
    };

    if (user) {
        initApp();
    } else if (!authLoading) {
        setIsReady(true); // Allow loading state to resolve even if not logged in to show Login
    }
  }, [user, authLoading]);

  // Global Keydown Handler (Ctrl + K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Persistence Effects (Triggered on changes)
  useEffect(() => { if(isReady) saveToStorage('products', products); }, [products, isReady]);
  useEffect(() => { if(isReady) saveToStorage('inventory', inventory); }, [inventory, isReady]);
  useEffect(() => { if(isReady) saveToStorage('rates', rates); }, [rates, isReady]);
  useEffect(() => { if(isReady) saveToStorage('transactions', transactions); }, [transactions, isReady]);
  useEffect(() => { if(isReady) saveToStorage('expenses', expenses); }, [expenses, isReady]);
  useEffect(() => { if(isReady) saveToStorage('transfers', transfers); }, [transfers, isReady]);
  useEffect(() => { if(isReady) saveToStorage('accounts', accounts); }, [accounts, isReady]);
  useEffect(() => { if(isReady) saveToStorage('clients', clients); }, [clients, isReady]);
  useEffect(() => { if(isReady) saveToStorage('settings', settings); }, [settings, isReady]);

  // Apply Theme Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Function to fetch BCV Rate
  const fetchBCVRate = async () => {
    setLoadingRate(true);
    try {
      const response = await fetch('https://api.dolarvzla.com/public/exchange-rate', {
        headers: {
          'x-dolarvzla-key': '7ef782904c6523350841061468e8d5f318e1fb1ec26cd4e7fae895defa68ef29'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.current && data.current.usd) {
          const newRate = parseFloat(data.current.usd);
          setRates(prev => ({
            ...prev,
            bcv: newRate
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching rates:", error);
    } finally {
      setLoadingRate(false);
    }
  };

  // --- Security Logic ---
  const executeProtectedAction = (action: () => void) => {
      if (settings.adminPin) {
          setPendingAction(() => action);
          setIsPinModalOpen(true);
      } else {
          action();
      }
  };

  const handlePinSuccess = () => {
      setIsPinModalOpen(false);
      if (pendingAction) {
          pendingAction();
          setPendingAction(null);
      }
  };

  // Derived State
  const activeRate = rates.selected === RateType.BCV ? rates.bcv : rates.parallel;
  
  const cartTotalUSD = useMemo(() => 
    cart.reduce((sum, item) => sum + (item.priceUSD * item.quantity), 0), 
  [cart]);

  const cartTotalVES = cartTotalUSD * activeRate;

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const filteredProducts = useMemo(() => {
    let result = products;
    if (categoryFilter !== 'Todas') {
      result = result.filter(p => p.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return result;
  }, [products, categoryFilter, searchQuery]);

  // Inventory Quick View
  const lowStockItem = useMemo(() => {
      if (inventory.length === 0) return null;
      return inventory.reduce((prev, curr) => prev.quantity < curr.quantity ? prev : curr, inventory[0]);
  }, [inventory]);

  // Actions
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };
  
  const setItemQuantity = (productId: string, quantity: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, quantity) };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(p => p.id !== productId));
  };

  const updatePrice = (productId: string, newPriceUSD: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, priceUSD: newPriceUSD };
      }
      return item;
    }));
  };

  // Global Search Handlers
  const handleSelectClientFromSearch = (client: Client) => {
    // Open Dashboard in Clients tab with this client selected
    setDashboardInitialClient(client);
    executeProtectedAction(() => setIsDashboardOpen(true));
  };

  const handleSelectTransactionFromSearch = (tx: Transaction) => {
    handleReprintTransaction(tx);
  };

  // --- AUTO BACKUP LOGIC ---
  const triggerAutoBackup = (currentData: BackupData) => {
      const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      link.download = `serendipia_autobackup_${dateStr}_${timeStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Update Settings to know backup was done
      setSettings(prev => ({ ...prev, lastBackup: Date.now() }));
      setNeedsBackup(false);
  };

  const handleCheckout = (
    payments: { method: PaymentMethod; amount: number; amountInUSD: number; reference?: string }[], 
    clientData: { id?: string, name: string } | undefined,
    shouldPrint: boolean,
    customDate?: string,
    printMode: PrintMode = 'MIXED'
  ) => {
    
    // Determine Timestamp
    let timestamp = Date.now();
    if (customDate) {
        const [year, month, day] = customDate.split('-').map(Number);
        const now = new Date();
        const customDateObj = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
        timestamp = customDateObj.getTime();
    }

    // Find client details if ID is provided
    let fullClient = clientData?.id ? clients.find(c => c.id === clientData.id) : null;

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      timestamp: timestamp,
      items: [...cart],
      totalUSD: cartTotalUSD,
      totalVES: cartTotalVES,
      rateUsed: activeRate,
      payments,
      debtPayments: [], 
      clientId: clientData?.id,
      clientName: clientData?.name || fullClient?.name,
      clientDoc: fullClient?.docId, 
      isPaid: !payments.some(p => p.method === PaymentMethod.CREDIT)
    };

    // 1. Update Inventory (Subtract)
    const newInventory = [...inventory];
    cart.forEach(item => {
        // Handle Multiple Materials
        if (item.materials && item.materials.length > 0) {
            item.materials.forEach(mat => {
                if (mat.inventoryId && mat.consumption > 0) {
                    const invIndex = newInventory.findIndex(inv => inv.id === mat.inventoryId);
                    if (invIndex > -1) {
                        newInventory[invIndex] = {
                            ...newInventory[invIndex],
                            quantity: newInventory[invIndex].quantity - (mat.consumption * item.quantity)
                        };
                    }
                }
            });
        } 
        // Handle Legacy Single Material (Backward Compatibility)
        else if (item.inventoryId && item.consumption) {
            const invIndex = newInventory.findIndex(inv => inv.id === item.inventoryId);
            if (invIndex > -1) {
                newInventory[invIndex] = {
                    ...newInventory[invIndex],
                    quantity: newInventory[invIndex].quantity - (item.consumption * item.quantity)
                };
            }
        }
        // Handle Legacy Paper Consumption Special Case
        else if ((item as any).paperConsumption) {
             const invIndex = newInventory.findIndex(inv => inv.id === DEFAULT_PAPER_ID);
             if (invIndex > -1) {
                newInventory[invIndex] = {
                    ...newInventory[invIndex],
                    quantity: newInventory[invIndex].quantity - ((item as any).paperConsumption * item.quantity)
                };
             }
        }
    });
    setInventory(newInventory);

    // 2. Update Account Balances
    setAccounts(prevAccounts => {
        const nextAccounts = [...prevAccounts];
        payments.forEach(p => {
            if (p.method !== PaymentMethod.CREDIT) {
                const accIndex = nextAccounts.findIndex(acc => acc.methodKey === p.method);
                if (accIndex > -1) {
                    nextAccounts[accIndex] = {
                        ...nextAccounts[accIndex],
                        balance: nextAccounts[accIndex].balance + p.amount
                    };
                }
            }
        });
        return nextAccounts;
    });

    // 3. Save Transaction
    const updatedTransactions = [...transactions, newTransaction];
    setTransactions(updatedTransactions);
    
    // Clear Debt Receipt state to avoid conflicts
    setReceiptDebtPayment(null);
    setReceiptTransaction(newTransaction);
    setReceiptPrintMode(printMode);

    // 4. Auto Backup Check
    if (updatedTransactions.length % 10 === 0) {
        const backupData: BackupData = {
            products,
            inventory: newInventory,
            transactions: updatedTransactions,
            expenses,
            rates,
            accounts,
            transfers,
            clients,
            settings: { ...settings, lastBackup: Date.now() },
            exportDate: Date.now(),
            version: '1.2'
        };
        setTimeout(() => triggerAutoBackup(backupData), 1000);
    }

    setCart([]);
    setIsCheckoutOpen(false);

    if (shouldPrint) {
      setTimeout(() => {
        window.print();
      }, 100);
    }
  };

  const handleRegisterDebtPayment = (transactionId: string, payment: TransactionPayment, accountId: string, shouldClose: boolean = false, shouldPrint: boolean = false) => {
      const paymentWithTimestamp = { ...payment, timestamp: Date.now() };
      
      let debtReceiptData = null;

      setTransactions(prev => prev.map(tx => {
          if (tx.id === transactionId) {
              const currentDebtPayments = tx.debtPayments || [];
              const updatedDebtPayments = payment.amount > 0 ? [...currentDebtPayments, paymentWithTimestamp] : currentDebtPayments;
              
              // Stats for receipt
              const initialCredit = tx.payments.find(p => p.method === PaymentMethod.CREDIT)?.amountInUSD || 0;
              const alreadyPaid = currentDebtPayments.reduce((sum, p) => sum + p.amountInUSD, 0);
              const remainingBefore = Math.max(0, initialCredit - alreadyPaid);
              const remainingAfter = Math.max(0, remainingBefore - payment.amountInUSD);
              
              const isPaidMath = remainingAfter <= 0.01;

              if (shouldPrint) {
                  debtReceiptData = {
                      clientName: tx.clientName || 'Cliente',
                      transactionId: tx.id,
                      timestamp: Date.now(),
                      amountPaid: payment.amountInUSD,
                      paymentMethod: payment.method,
                      previousDebt: remainingBefore,
                      newDebt: remainingAfter
                  };
              }

              return {
                  ...tx,
                  debtPayments: updatedDebtPayments,
                  isPaid: shouldClose || isPaidMath
              };
          }
          return tx;
      }));

      if (payment.amount > 0 && accountId) {
          setAccounts(prev => prev.map(acc => {
              if (acc.id === accountId) {
                  return { ...acc, balance: acc.balance + payment.amount };
              }
              return acc;
          }));
      }

      if (shouldPrint && debtReceiptData) {
          setReceiptTransaction(null); // Ensure regular receipt is hidden
          setReceiptDebtPayment(debtReceiptData);
          setReceiptPrintMode('MIXED'); // Default for debt payments
          setTimeout(() => window.print(), 100);
      }
  };

  const handleReprintTransaction = (tx: Transaction, mode: PrintMode = 'MIXED') => {
    setReceiptDebtPayment(null);
    setReceiptTransaction(tx);
    setReceiptPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
  };

  // --- REVERSAL LOGIC FOR DELETING/EDITING ---
  const handleVoidTransaction = (txId: string) => {
    const action = () => {
        const tx = transactions.find(t => t.id === txId);
        if (!tx) return;

        try {
            if (tx.items && Array.isArray(tx.items)) {
                const newInventory = [...inventory];
                tx.items.forEach(item => {
                    // Reverse Multiple Materials
                    if (item.materials && item.materials.length > 0) {
                        item.materials.forEach(mat => {
                            if (mat.inventoryId && mat.consumption > 0) {
                                const invIndex = newInventory.findIndex(inv => inv.id === mat.inventoryId);
                                if (invIndex > -1) {
                                    newInventory[invIndex] = {
                                        ...newInventory[invIndex],
                                        quantity: newInventory[invIndex].quantity + (mat.consumption * item.quantity)
                                    };
                                }
                            }
                        });
                    }
                    // Reverse Legacy Single Material
                    else if (item.inventoryId && item.consumption) {
                        const invIndex = newInventory.findIndex(inv => inv.id === item.inventoryId);
                        if (invIndex > -1) {
                            newInventory[invIndex] = {
                                ...newInventory[invIndex],
                                quantity: newInventory[invIndex].quantity + (item.consumption * item.quantity)
                            };
                        }
                    } 
                    // Reverse Legacy Paper
                    else if ((item as any).paperConsumption) {
                        const invIndex = newInventory.findIndex(inv => inv.id === DEFAULT_PAPER_ID);
                        if (invIndex > -1) {
                            newInventory[invIndex] = {
                                ...newInventory[invIndex],
                                quantity: newInventory[invIndex].quantity + ((item as any).paperConsumption * item.quantity)
                            };
                        }
                    }
                });
                setInventory(newInventory);
            }

            if (tx.payments && Array.isArray(tx.payments)) {
                setAccounts(prevAccounts => {
                    const nextAccounts = [...prevAccounts];
                    tx.payments.forEach(p => {
                        const accIndex = nextAccounts.findIndex(acc => acc.methodKey === p.method);
                        if (accIndex > -1) {
                            nextAccounts[accIndex] = {
                                ...nextAccounts[accIndex],
                                balance: nextAccounts[accIndex].balance - p.amount
                            };
                        }
                    });
                    return nextAccounts;
                });
            }
        } catch (error) {
            console.error("Error reversing transaction effects:", error);
        }
        setTransactions(prev => prev.filter(t => t.id !== txId));
    };
    executeProtectedAction(action);
  };

  const handleRestoreTransaction = (txId: string) => {
      const tx = transactions.find(t => t.id === txId);
      if (!tx) return;
      if (tx.items && Array.isArray(tx.items)) setCart(tx.items);
      handleVoidTransaction(txId);
      setIsDashboardOpen(false);
  };

  const handleSaveProduct = (product: Product) => {
    setProducts(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) return prev.map(p => p.id === product.id ? product : p);
      return [...prev, product];
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  // Client Management
  const handleSaveClient = (client: Client) => {
    setClients(prev => {
        const exists = prev.find(c => c.id === client.id);
        if (exists) return prev.map(c => c.id === client.id ? client : c);
        return [...prev, client];
    });
  };

  const handleDeleteClient = (id: string) => {
      if (confirm('¿Eliminar cliente? Las transacciones pasadas mantendrán el registro.')) {
          setClients(prev => prev.filter(c => c.id !== id));
      }
  };

  // Money Out: Expense
  const handleAddExpense = (expense: Expense) => {
    setAccounts(prev => prev.map(acc => {
        if (acc.id === expense.accountId) {
            return { ...acc, balance: acc.balance - expense.amountPaid };
        }
        return acc;
    }));
    setExpenses(prev => [...prev, expense]);
  };

  const handleDeleteExpense = (id: string) => {
    const action = () => {
        const exp = expenses.find(e => e.id === id);
        if (exp) {
            setAccounts(prev => prev.map(acc => {
                if (acc.id === exp.accountId) {
                    return { ...acc, balance: acc.balance + exp.amountPaid };
                }
                return acc;
            }));
        }
        setExpenses(prev => prev.filter(e => e.id !== id));
    };
    executeProtectedAction(action);
  };

  // Money Out: Restock
  const handleRestock = (inventoryId: string, quantity: number, costUSD: number, paidFromAccountId: string, costInAccountCurrency: number, customDate?: string) => {
    let timestamp = Date.now();
    if (customDate) {
        const [year, month, day] = customDate.split('-').map(Number);
        const now = new Date();
        const customDateObj = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
        timestamp = customDateObj.getTime();
    }
    setInventory(prev => prev.map(item => {
      if (item.id === inventoryId) {
        return { ...item, quantity: item.quantity + quantity };
      }
      return item;
    }));
    setAccounts(prev => prev.map(acc => {
        if (acc.id === paidFromAccountId) {
            return { ...acc, balance: acc.balance - costInAccountCurrency };
        }
        return acc;
    }));
    const item = inventory.find(i => i.id === inventoryId);
    const itemName = item ? item.name : 'Material';
    const expense: Expense = {
      id: Date.now().toString(),
      description: `Compra: ${quantity}u de ${itemName}`,
      amountUSD: costUSD,
      amountPaid: costInAccountCurrency,
      category: 'Inventario',
      timestamp: timestamp,
      accountId: paidFromAccountId
    };
    setExpenses(prev => [...prev, expense]);
  };

  const handleManualAccountAdjustment = (accountId: string, amount: number) => {
      const action = () => {
          setAccounts(prev => prev.map(acc => {
              if (acc.id === accountId) {
                  return { ...acc, balance: acc.balance + amount };
              }
              return acc;
          }));
      };
      executeProtectedAction(action);
  };

  const handleTransfer = (params: { fromId: string; toId: string; amount: number; fee?: number; feeCurrency?: 'USD' | 'VES'; rate?: number; note?: string; customDate?: string }) => {
      const { fromId, toId, amount, fee = 0, feeCurrency, rate, note, customDate } = params;
      const fromAcc = accounts.find(a => a.id === fromId);
      const toAcc = accounts.find(a => a.id === toId);
      if (!fromAcc || !toAcc) return;
      if (fromId === toId) return;
      let timestamp = Date.now();
      if (customDate) {
          const [year, month, day] = customDate.split('-').map(Number);
          const now = new Date();
          const customDateObj = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
          timestamp = customDateObj.getTime();
      }
      const rateUsed = rate || activeRate;
      let amountTo = amount;
      if (fromAcc.type !== toAcc.type) {
          if (fromAcc.type === 'USD' && toAcc.type === 'VES') {
              amountTo = amount * rateUsed;
          } else if (fromAcc.type === 'VES' && toAcc.type === 'USD') {
              amountTo = amount / rateUsed;
          }
      }
      let feeInSource = 0;
      if (fee && fee > 0) {
          const srcCurrency = fromAcc.type;
          const fCurr = feeCurrency || srcCurrency;
          if (srcCurrency === fCurr) {
              feeInSource = fee;
          } else {
              if (srcCurrency === 'USD' && fCurr === 'VES') {
                  feeInSource = fee / rateUsed;
              } else if (srcCurrency === 'VES' && fCurr === 'USD') {
                  feeInSource = fee * rateUsed;
              }
          }
      }
      const totalOut = amount + feeInSource;
      if (fromAcc.balance < totalOut) {
          alert('Saldo insuficiente en la cuenta de origen.');
          return;
      }
      setAccounts(prev => prev.map(acc => {
          if (acc.id === fromId) {
              return { ...acc, balance: acc.balance - totalOut };
          }
          if (acc.id === toId) {
              return { ...acc, balance: acc.balance + amountTo };
          }
          return acc;
      }));
      const transfer: Transfer = {
          id: Date.now().toString(),
          timestamp,
          fromAccountId: fromId,
          toAccountId: toId,
          amountFrom: amount,
          amountTo,
          rateUsed,
          feeAmount: fee || undefined,
          feeCurrency: feeCurrency || undefined,
          note
      };
      setTransfers(prev => [...prev, transfer]);
  };

  const handleImportData = (data: BackupData) => {
    if (data.products) setProducts(data.products);
    if (data.inventory) setInventory(data.inventory);
    if (data.transactions) setTransactions(data.transactions);
    if (data.expenses) setExpenses(data.expenses);
    if (data.rates) setRates(data.rates);
    if (data.accounts) setAccounts(data.accounts);
    if (data.transfers) setTransfers(data.transfers);
    if (data.clients) setClients(data.clients);
    if (data.settings) setSettings(data.settings);
    // Remove warning if imported
    setNeedsBackup(false);
  };

  if (authLoading || !isReady) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-primary">
              <div className="flex flex-col items-center">
                  <Loader2 size={48} className="animate-spin mb-4" />
                  <h1 className="text-xl font-bold">Cargando SerendipiAPP...</h1>
                  <p className="text-sm text-gray-500 mt-2">Iniciando base de datos segura</p>
              </div>
          </div>
      );
  }

  if (!user) {
      return <Login />;
  }

  return (
    <div className="min-h-screen flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Receipt transaction={receiptTransaction} debtPayment={receiptDebtPayment} mode={receiptPrintMode} />

      {/* PIN Verification Modal */}
      <PinModal 
         isOpen={isPinModalOpen}
         onClose={() => { setIsPinModalOpen(false); setPendingAction(null); }}
         onSuccess={handlePinSuccess}
         correctPin={settings.adminPin}
      />
      
      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={products}
        clients={clients}
        transactions={transactions}
        onSelectProduct={addToCart}
        onSelectClient={handleSelectClientFromSearch}
        onSelectTransaction={handleSelectTransactionFromSearch}
      />

      {/* Backup Warning Banner */}
      {needsBackup && (
          <div className="bg-orange-500 text-white p-2 text-center text-sm font-bold flex justify-center items-center gap-2 shadow-md relative z-20">
              <AlertTriangle size={16} />
              <span>Advertencia: No has descargado un respaldo en varios días. ¡Tus datos corren peligro si se borra el historial!</span>
              <button 
                onClick={() => executeProtectedAction(() => setIsDashboardOpen(true))}
                className="bg-white text-orange-600 px-2 py-0.5 rounded text-xs hover:bg-gray-100 ml-2"
              >
                Hacer Copia Ahora
              </button>
              <button onClick={() => setNeedsBackup(false)} className="absolute right-4 text-white/80 hover:text-white"><Plus size={16} className="rotate-45" /></button>
          </div>
      )}

      {/* --- Header & Rates --- */}
      <header className="bg-white dark:bg-gray-800 shadow-md z-10 no-print border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:py-3 flex justify-between items-center gap-2">
          <div className="flex items-center space-x-2 shrink-0">
            {isMobile && mobileView !== 'landing' && (
                <button onClick={() => setMobileView('landing')} className="p-2 -ml-2 text-gray-400 hover:text-primary transition-colors">
                    <ArrowLeft size={20} />
                </button>
            )}
            <div className="bg-primary text-white p-1.5 sm:p-2 rounded-lg font-bold text-lg sm:text-xl shadow-lg shadow-blue-500/30">SD</div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white hidden sm:block">SerendipiAPP</h1>
          </div>

          {/* Rate Display / Editor */}
          <div className="flex items-center space-x-2 text-xs sm:text-base overflow-x-auto no-scrollbar">
            <div className={`flex flex-row space-x-1 sm:space-x-2 items-center ${showRateEdit ? 'hidden' : 'flex'}`}>
               <button 
                onClick={() => setRates(r => ({...r, selected: RateType.BCV}))}
                className={`px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap ${rates.selected === RateType.BCV ? 'bg-green-100 dark:bg-green-900/30 border-green-500 border text-green-800 dark:text-green-300 font-bold' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}
               >
                 BCV: {rates.bcv.toFixed(2)}
               </button>
               <button 
                onClick={() => setRates(r => ({...r, selected: RateType.PARALLEL}))}
                className={`px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap ${rates.selected === RateType.PARALLEL ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 border text-yellow-800 dark:text-yellow-300 font-bold' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}
               >
                 Par.: {rates.parallel.toFixed(2)}
               </button>
               <button 
                 onClick={fetchBCVRate} 
                 className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all ${loadingRate ? 'animate-spin text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-600'}`}
                 title="Sincronizar BCV"
               >
                 <RefreshCw size={14} className="sm:w-4 sm:h-4" />
               </button>
            </div>

            {showRateEdit && (
              <div className="flex space-x-1 items-center bg-gray-50 dark:bg-gray-700 p-1 rounded border border-gray-200 dark:border-gray-600">
                <div className="flex flex-col">
                  <span className="text-[8px] sm:text-[9px] text-gray-500 dark:text-gray-400 px-1">BCV</span>
                  <input type="number" value={rates.bcv} onChange={(e) => setRates(prev => ({...prev, bcv: parseFloat(e.target.value)}))} className="w-16 p-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] sm:text-[9px] text-gray-500 dark:text-gray-400 px-1">Paralelo</span>
                  <input type="number" value={rates.parallel} onChange={(e) => setRates(prev => ({...prev, parallel: parseFloat(e.target.value)}))} className="w-16 p-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-600" />
                </div>
                <button onClick={() => setShowRateEdit(false)} className="text-white bg-green-500 p-1.5 rounded hover:bg-green-600 shadow-sm"><Check size={14}/></button>
              </div>
            )}

            {!showRateEdit && (
              <button onClick={() => setShowRateEdit(true)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"><Settings size={18} className="sm:w-5 sm:h-5" /></button>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
             {/* Global Search Button */}
             <button 
                onClick={() => setIsSearchOpen(true)}
                className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                title="Buscar (Ctrl + K)"
             >
               <Search size={20} />
             </button>

             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full text-gray-400 hover:text-gray-800 dark:text-gray-400 dark:hover:text-yellow-400 transition-colors">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             
             {/* Action Buttons */}
             <div className="flex items-center gap-2 border-l pl-2 border-gray-200 dark:border-gray-600 ml-1">
                <button 
                    onClick={() => executeProtectedAction(() => setIsProductManagerOpen(true))}
                    className="bg-white dark:bg-gray-700 border dark:border-gray-600 text-gray-600 dark:text-gray-200 p-2 rounded-full hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm"
                    title="Editar Productos"
                >
                    <Package size={20} />
                </button>
                <button 
                    onClick={() => executeProtectedAction(() => setIsDashboardOpen(true))}
                    className="bg-secondary text-white p-2 rounded-full hover:bg-gray-600 dark:hover:bg-gray-500 transition shadow-lg shadow-gray-400/30"
                    title="Ver Estadísticas y Gastos"
                >
                <BarChart2 size={24} />
                </button>
                <button 
                    onClick={() => supabase.auth.signOut()}
                    className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                    title="Cerrar Sesión"
                >
                    <LogOut size={20} />
                </button>
             </div>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden no-print relative">
        {/* Mobile View Navigation (Landing Page) */}
        {isMobile && mobileView === 'landing' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 gap-6">
             <div className="text-center mb-4">
                <img src="/logo-serendipia.svg" alt="Serendipia" className="w-32 h-32 mx-auto mb-4 drop-shadow-xl" />
                <h1 className="text-2xl font-black text-primary dark:text-blue-400">SerendipiAPP</h1>
                <p className="text-gray-500 text-sm">Control de Punto de Venta</p>
             </div>
             <button 
                onClick={() => setMobileView('pos')}
                className="w-full max-w-sm bg-primary hover:bg-blue-700 text-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3 transition-transform active:scale-95"
             >
                <div className="bg-white/20 p-3 rounded-full">
                    <ShoppingCart size={40} />
                </div>
                <span className="text-xl font-bold">NUEVA VENTA</span>
                <span className="text-xs opacity-80">Registrar productos y cobrar</span>
             </button>
             
             <button 
                onClick={() => executeProtectedAction(() => setIsDashboardOpen(true))}
                className="w-full max-w-sm bg-secondary hover:bg-slate-700 text-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3 transition-transform active:scale-95"
             >
                <div className="bg-white/20 p-3 rounded-full">
                    <BarChart2 size={40} />
                </div>
                <span className="text-xl font-bold">PANEL DE CONTROL</span>
                <span className="text-xs opacity-80">Estadísticas, Gastos y Caja</span>
             </button>

             <button 
                onClick={() => executeProtectedAction(() => setIsProductManagerOpen(true))}
                className="w-full max-w-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center gap-2"
             >
                <Package size={20} />
                <span className="font-bold">Editar Inventario</span>
             </button>
          </div>
        ) : (
          <>
            {/* Left: Product Grid / Mobile Tab Content */}
            <div className={`flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-100/50 dark:bg-gray-900 ${isMobile ? 'pb-24' : 'pb-4'}`}>
              
              {/* Mobile Tab Header */}
              {isMobile && (
                <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 mb-3 shadow-sm border dark:border-gray-700">
                    <button 
                        onClick={() => setMobileTab('products')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mobileTab === 'products' ? 'bg-primary text-white shadow-md' : 'text-gray-500'}`}
                    >
                        Productos
                    </button>
                    <button 
                        onClick={() => setMobileTab('cart')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${mobileTab === 'cart' ? 'bg-primary text-white shadow-md' : 'text-gray-500'}`}
                    >
                        Orden {cart.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{cart.reduce((a,c) => a+c.quantity,0)}</span>}
                    </button>
                </div>
              )}

              {/* View: Products (Mobile or Desktop) */}
              {(!isMobile || mobileTab === 'products') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                  {/* Search and Filters */}
                  <div className="flex gap-2 sticky top-0 z-10 py-1 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-primary shadow-sm outline-none dark:text-white"
                            placeholder="Buscar producto..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                  </div>

                  <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar py-1">
                    <button onClick={() => setCategoryFilter('Todas')} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${categoryFilter === 'Todas' ? 'bg-primary border-primary text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}>Todas</button>
                    {categories.map(cat => (
                    <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${categoryFilter === cat ? 'bg-primary border-primary text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}>{cat}</button>
                    ))}
                  </div>

                  <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}`}>
                    {filteredProducts.map(product => (
                    <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className={`relative bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between border border-transparent hover:border-primary group ${isMobile ? 'h-16' : 'h-32 flex-col items-stretch'}`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {isMobile && (
                             <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary font-bold shrink-0">
                                {product.name.charAt(0).toUpperCase()}
                             </div>
                          )}
                          <div className="overflow-hidden">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 leading-tight line-clamp-1 text-sm sm:text-base">{product.name}</h3>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{product.category}</p>
                          </div>
                        </div>
                        <div className={`flex ${isMobile ? 'flex-col items-end shrink-0' : 'mt-auto justify-between items-end'}`}>
                        <div className="text-right">
                            <span className={`block font-bold text-primary dark:text-blue-400 ${isMobile ? 'text-base' : 'text-lg'}`}>${product.priceUSD.toFixed(2)}</span>
                            <span className="block text-[10px] text-gray-400 dark:text-gray-500">Bs. {(product.priceUSD * activeRate).toFixed(2)}</span>
                        </div>
                        </div>
                    </button>
                    ))}
                  </div>
                </div>
              )}

              {/* View: Cart (Mobile Only Tab) */}
              {isMobile && mobileTab === 'cart' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Detalle de la Orden</h2>
                        <button onClick={() => setCart([])} className="text-xs text-red-500 font-bold flex items-center gap-1" disabled={cart.length === 0}><Trash2 size={12} /> Vaciar</button>
                    </div>
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 opacity-50 dark:text-gray-600">
                            <ShoppingCart size={64} className="mb-4" />
                            <p className="font-bold">No hay productos en la orden</p>
                            <button onClick={() => setMobileTab('products')} className="mt-4 text-primary font-bold underline">Ir a Productos</button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cart.map(item => (<CartItemRow key={item.id} item={item} activeRate={activeRate} updateQuantity={updateQuantity} setItemQuantity={setItemQuantity} removeFromCart={removeFromCart} updatePrice={updatePrice} />))}
                            
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 mt-6 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 text-sm">Subtotal USD</span>
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">${cartTotalUSD.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b dark:border-gray-700">
                                    <span className="text-gray-500 text-sm">Subtotal Bs</span>
                                    <span className="text-lg font-bold text-primary dark:text-blue-400">Bs. {cartTotalVES.toFixed(2)}</span>
                                </div>
                                <button onClick={() => setIsCheckoutOpen(true)} className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg flex justify-between px-6 items-center active:scale-95 transition-transform mt-4">
                                    <span className="text-lg">COBRAR AHORA</span>
                                    <ArrowRight size={24} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
              )}

            </div>

            {/* Right: Cart (Desktop Sidebar) */}
            <div className="hidden md:flex w-96 bg-white dark:bg-gray-800 shadow-xl flex-col border-l border-gray-200 dark:border-gray-700 z-0 h-full">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Orden Actual</h2>
                <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 flex items-center gap-1" disabled={cart.length === 0}><Trash2 size={12} /> Limpiar</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50 dark:text-gray-600"><div className="text-6xl mb-2">🛒</div><p>Carrito vacío</p></div>
                ) : (
                  cart.map(item => (<CartItemRow key={item.id} item={item} activeRate={activeRate} updateQuantity={updateQuantity} setItemQuantity={setItemQuantity} removeFromCart={removeFromCart} updatePrice={updatePrice} />))
                )}
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="flex justify-between items-end mb-2"><span className="text-gray-500 dark:text-gray-400 text-sm">Total USD</span><span className="text-2xl font-bold text-gray-900 dark:text-white">${cartTotalUSD.toFixed(2)}</span></div>
                <div className="flex justify-between items-end mb-4"><span className="text-gray-500 dark:text-gray-400 text-sm">Total Bs ({rates.selected})</span><span className="text-xl font-bold text-primary dark:text-blue-400">Bs. {cartTotalVES.toFixed(2)}</span></div>
                <button onClick={() => setIsCheckoutOpen(true)} disabled={cart.length === 0} className="w-full bg-primary hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-lg flex justify-between items-center group"><span>Cobrar</span><span className="bg-white/20 px-2 py-0.5 rounded text-sm group-hover:bg-white/30 transition">Enter ↵</span></button>
              </div>
            </div>
          </>
        )}

        {/* Mobile Sticky Cart Footer */}
        <div className="md:hidden fixed bottom-16 left-4 right-4 z-30 pointer-events-none">
            {cart.length > 0 && (
                <div className="pointer-events-auto bg-primary text-white p-3 rounded-2xl shadow-2xl flex justify-between items-center animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="bg-white text-primary w-10 h-10 rounded-xl flex items-center justify-center font-bold">
                                {cart.reduce((a,c) => a + c.quantity, 0)}
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold opacity-80 leading-none mb-1">Total Orden</p>
                            <p className="text-xl font-black leading-none">${cartTotalUSD.toFixed(2)}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsCheckoutOpen(true)} 
                        className="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
                    >
                        Cobrar <ArrowRight size={18} />
                    </button>
                </div>
            )}
        </div>

      </main>

      {/* --- Modals --- */}
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} totalUSD={cartTotalUSD} rates={rates} onConfirm={handleCheckout} clients={clients} onSaveClient={handleSaveClient} />

      <DashboardModal 
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        inventory={inventory}
        transactions={transactions}
        expenses={expenses}
        products={products}
        rates={rates}
        accounts={accounts} 
        transfers={transfers}
        clients={clients}
        settings={settings}
        onAddExpense={handleAddExpense}
        onDeleteExpense={handleDeleteExpense}
        onUpdateInventory={setInventory}
        onRestock={handleRestock} 
        onImportData={handleImportData}
        currentRate={activeRate}
        onManualAdjustment={handleManualAccountAdjustment} 
        onVoidTransaction={handleVoidTransaction} 
        onRestoreTransaction={handleRestoreTransaction} 
        onSaveClient={handleSaveClient}
        onDeleteClient={handleDeleteClient}
        onReprintTransaction={handleReprintTransaction}
        onUpdateTransaction={handleUpdateTransaction}
        onRegisterDebtPayment={handleRegisterDebtPayment}
        onSaveSettings={setSettings}
        onTransfer={handleTransfer}
        // Pass prop to allow search to jump to specific client
        // Note: You need to modify StatsModal to accept this prop if not already
        // For now we assume StatsModal handles viewingClient state internally via props update or context
      />

      <ProductManager isOpen={isProductManagerOpen} onClose={() => { setIsProductManagerOpen(false); setProductToEditId(null); }} products={products} inventoryItems={inventory} onSave={handleSaveProduct} onDelete={handleDeleteProduct} initialEditId={productToEditId || undefined} />
      
      {quickEditProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[80]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border dark:border-gray-700">
            <div className="flex justify-between items-center p-3 border-b dark:border-gray-700">
              <div>
                <div className="text-sm font-bold text-gray-800 dark:text-white truncate max-w-[16rem]">{quickEditProduct.name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{quickEditProduct.category}</div>
              </div>
              <button 
                onClick={() => { setQuickEditProduct(null); setQuickEditPrice(''); }} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Cerrar"
              >
                <X size={16}/>
              </button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300">Precio USD</label>
                <input 
                  className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-600"
                  type="number" step="0.01" 
                  value={quickEditPrice}
                  onChange={e => setQuickEditPrice(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
                <div className="text-[11px] text-gray-500 mt-1">Bs. {(parseFloat(quickEditPrice || '0') * activeRate).toFixed(2)}</div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const num = parseFloat(quickEditPrice);
                    if (!isNaN(num) && num >= 0) {
                      setProducts(prev => prev.map(p => p.id === quickEditProduct.id ? { ...p, priceUSD: num } : p));
                      setQuickEditProduct(null);
                      setQuickEditPrice('');
                    }
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded flex items-center justify-center gap-2"
                >
                  <Save size={16}/> Guardar
                </button>
                <button 
                  onClick={() => { 
                    setQuickEditProduct(null); 
                    setQuickEditPrice(''); 
                    executeProtectedAction(() => setIsProductManagerOpen(true)); 
                  }} 
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-2 rounded"
                  title="Edición avanzada"
                >
                  Avanzado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
