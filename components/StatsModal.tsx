import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DailyStats, PaymentMethod, Transaction, Expense, InventoryItem, Product, ExchangeRates, BackupData, Account, Client, TransactionPayment, AppSettings, PrintMode, Transfer } from '../types';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Trash2, Plus, Calendar, DollarSign, List, ShoppingBag, Box, Save, X, Edit2, ShoppingCart, Database, Download, Upload, AlertTriangle, Wallet, ArrowRightLeft, RotateCcw, CheckCircle, AlertOctagon, FileText, FileSpreadsheet, TrendingUp, Award, User, Check, Users, Printer, Pencil, Ban, ArrowLeft, Clock, Lock, ChevronLeft, ChevronRight, ShieldCheck, Activity, TrendingDown, Banknote, Globe } from 'lucide-react';
import { DEFAULT_PAPER_ID } from '../constants';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  transactions: Transaction[];
  expenses: Expense[];
  products: Product[];
  rates: ExchangeRates;
  accounts: Account[];
  transfers: Transfer[];
  clients: Client[];
  settings: AppSettings;
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateInventory: (items: InventoryItem[]) => void;
  onRestock: (id: string, qty: number, cost: number, paidFromAccountId: string, costInAccountCurrency: number, customDate?: string) => void;
  onImportData: (data: BackupData) => void;
  onManualAdjustment: (accountId: string, amount: number) => void;
  onVoidTransaction: (id: string) => void;
  onRestoreTransaction: (id: string) => void;
  onSaveClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onReprintTransaction: (tx: Transaction, mode?: PrintMode) => void;
  onUpdateTransaction: (tx: Transaction) => void;
  onRegisterDebtPayment: (transactionId: string, payment: TransactionPayment, accountId: string, shouldClose: boolean, shouldPrint: boolean) => void;
  onSaveSettings: (settings: AppSettings) => void;
  currentRate: number;
  onTransfer: (params: { fromId: string; toId: string; amount: number; fee?: number; feeCurrency?: 'USD' | 'VES'; rate?: number; note?: string; customDate?: string }) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const CURRENCY_COLORS = ['#16a34a', '#2563eb']; // Green for Hard, Blue for Local
const ITEMS_PER_PAGE = 50; 

type FilterType = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type CurrencyMode = 'USD' | 'VES';

export const DashboardModal: React.FC<DashboardModalProps> = ({ 
  isOpen, onClose, inventory, transactions, expenses, products, rates, accounts, transfers, clients, settings, onAddExpense, onDeleteExpense, onUpdateInventory, onRestock, onImportData, onManualAdjustment, onVoidTransaction, onRestoreTransaction, onSaveClient, onDeleteClient, onReprintTransaction, onUpdateTransaction, onRegisterDebtPayment, onSaveSettings, currentRate, onTransfer
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'expenses' | 'inventory' | 'treasury' | 'data' | 'debts' | 'clients'>('overview');
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('USD');
  const [newExpense, setNewExpense] = useState({ desc: '', amount: '', accountId: '' });
  const [expenseCurrency, setExpenseCurrency] = useState<CurrencyMode>('USD'); 
  const [expenseDate, setExpenseDate] = useState<string>(''); 
  const [reprintMode, setReprintMode] = useState<PrintMode>('MIXED');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [expCurrentPage, setExpCurrentPage] = useState(1);

  // Confirmation State
  const [confirmAction, setConfirmAction] = useState<{ type: 'VOID' | 'RESTORE' | 'DELETE_INV' | 'IMPORT', id?: string, data?: any } | null>(null);

  // Date Filters
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Settings State
  const [newPin, setNewPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  // Inventory Edit
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [invFormData, setInvFormData] = useState<InventoryItem>({ id: '', name: '', quantity: 0, unit: 'unidades' });

  // Client Edit
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientFormData, setClientFormData] = useState<Client>({ id: '', name: '', docId: '', phone: '', address: '' });
  const [viewingClient, setViewingClient] = useState<Client | null>(null); 

  // Purchase/Restock
  const [showRestockForm, setShowRestockForm] = useState(false);
  const [restockData, setRestockData] = useState({ id: '', itemName: '', qty: '', cost: '', accountId: '', date: '' });

  // Debt Payment Modal State
  const [debtPaymentModal, setDebtPaymentModal] = useState<{ 
      isOpen: boolean, 
      txId: string, 
      clientName: string, 
      remainingDebtUSD: number, 
      amount: string, 
      method: string, 
      accountId: string,
      currency: CurrencyMode,
      markAsPaid: boolean
  } | null>(null);

  // Manual Adjustment
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({ accountId: '', amount: '', type: 'IN' as 'IN' | 'OUT' });

  // Transaction Edit
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTxData, setEditTxData] = useState<{ date: string, clientName: string, clientDoc: string, payments: any[] }>({ date: '', clientName: '', clientDoc: '', payments: [] });

  // File Input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset pagination when filter changes
  useEffect(() => { setCurrentPage(1); setExpCurrentPage(1); }, [filterType, customStart, customEnd, activeTab]);

  useEffect(() => {
     if(!isOpen) {
         setViewingClient(null);
     }
  }, [isOpen]);

  // --- Calculations ---
  const dateRange = useMemo(() => {
      const now = new Date();
      let start = new Date();
      let end = new Date();
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      if (filterType === 'yesterday') { start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); }
      else if (filterType === 'week') { const day = now.getDay() || 7; if (day !== 1) start.setHours(-24 * (day - 1)); }
      else if (filterType === 'month') { start.setDate(1); }
      else if (filterType === 'custom' && customStart) { 
          start = new Date(customStart); 
          start.setHours(0,0,0,0); 
          if (customEnd) { end = new Date(customEnd); end.setHours(23,59,59,999); } else { end = new Date(customStart); end.setHours(23,59,59,999); }
      }
      return { start: start.getTime(), end: end.getTime() };
  }, [filterType, customStart, customEnd]);

  const filteredTransactions = useMemo(() => {
      if (!Array.isArray(transactions)) return [];
      const sorted = transactions.filter(t => t.timestamp >= dateRange.start && t.timestamp <= dateRange.end).sort((a,b) => b.timestamp - a.timestamp);
      return sorted;
  }, [transactions, dateRange]);

  const filteredExpenses = useMemo(() => {
      if (!Array.isArray(expenses)) return [];
      const sorted = expenses.filter(e => e.timestamp >= dateRange.start && e.timestamp <= dateRange.end).sort((a,b) => b.timestamp - a.timestamp);
      return sorted;
  }, [expenses, dateRange]);

  const paginatedTransactions = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  const paginatedExpenses = useMemo(() => {
    const start = (expCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExpenses, expCurrentPage]);

  const totalTxPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const totalExpPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);

  const currentLiquidity = useMemo(() => {
    return accounts.reduce((total, account) => {
      if (currencyMode === 'USD') {
        return total + (account.type === 'USD' ? account.balance : account.balance / currentRate);
      } else {
        return total + (account.type === 'VES' ? account.balance : account.balance * currentRate);
      }
    }, 0);
  }, [accounts, currentRate, currencyMode]);

  const stats = useMemo(() => {
      const s = {
          totalSalesUSD: 0,
          totalDebtUSD: 0,
          totalExpensesUSD: filteredExpenses.reduce((sum, e) => sum + (e.amountUSD || 0), 0),
          netIncomeUSD: 0,
          methodBreakdown: { [PaymentMethod.USD_CASH]: 0, [PaymentMethod.VES_CASH]: 0, [PaymentMethod.VES_PAGO_MOVIL]: 0, [PaymentMethod.USDT]: 0, [PaymentMethod.CREDIT]: 0 } as Record<PaymentMethod, number>,
          transactionsCount: filteredTransactions.length,
          inventoryConsumed: {} as Record<string, number>
      };
      filteredTransactions.forEach(t => {
          if (Array.isArray(t.payments)) { 
             t.payments.forEach(p => { 
                if (p && p.method) {
                   if (p.method === PaymentMethod.CREDIT) { s.totalDebtUSD += (p.amountInUSD || 0); } else { s.totalSalesUSD += (p.amountInUSD || 0); if (s.methodBreakdown[p.method] !== undefined) { s.methodBreakdown[p.method] += (p.amountInUSD || 0); } }
                }
             }); 
          }
          if (Array.isArray(t.items)) { t.items.forEach(item => { if (item.materials && item.materials.length > 0) { item.materials.forEach(mat => { if (mat.inventoryId && mat.consumption) { s.inventoryConsumed[mat.inventoryId] = (s.inventoryConsumed[mat.inventoryId] || 0) + (mat.consumption * item.quantity); } }); } else if (item.inventoryId && item.consumption) { s.inventoryConsumed[item.inventoryId] = (s.inventoryConsumed[item.inventoryId] || 0) + (item.consumption * item.quantity); } else if ((item as any).paperConsumption) { s.inventoryConsumed[DEFAULT_PAPER_ID] = (s.inventoryConsumed[DEFAULT_PAPER_ID] || 0) + ((item as any).paperConsumption * item.quantity); } }); }
      });
      transactions.forEach(t => {
          if (t.debtPayments && Array.isArray(t.debtPayments)) { t.debtPayments.forEach(p => { const pTime = p.timestamp || 0; if (pTime >= dateRange.start && pTime <= dateRange.end) { s.totalSalesUSD += (p.amountInUSD || 0); if (p.method && s.methodBreakdown[p.method] !== undefined) { s.methodBreakdown[p.method] += (p.amountInUSD || 0); } if (t.timestamp >= dateRange.start && t.timestamp <= dateRange.end) { s.totalDebtUSD -= (p.amountInUSD || 0); } } }); }
      });
      s.netIncomeUSD = s.totalSalesUSD - s.totalExpensesUSD; s.totalDebtUSD = Math.max(0, s.totalDebtUSD);
      return s;
  }, [filteredTransactions, filteredExpenses, transactions, dateRange]);

  const efficiencyStats = useMemo(() => {
    let totalCreditIssued = 0; let totalCreditPaid = 0;
    transactions.forEach(t => { const creditP = t.payments.find(p => p.method === PaymentMethod.CREDIT); if(creditP) { totalCreditIssued += creditP.amountInUSD; const paid = t.debtPayments?.reduce((sum, dp) => sum + dp.amountInUSD, 0) || 0; totalCreditPaid += paid; } });
    const efficiency = totalCreditIssued > 0 ? (totalCreditPaid / totalCreditIssued) * 100 : 100;
    return { issued: totalCreditIssued, paid: totalCreditPaid, efficiency };
  }, [transactions]);

  const timeSeriesData = useMemo(() => {
      const dataMap = new Map<string, { date: string, sales: number, expense: number }>();
      filteredTransactions.forEach(t => { const dateKey = new Date(t.timestamp).toLocaleDateString(); if(!dataMap.has(dateKey)) dataMap.set(dateKey, { date: dateKey, sales: 0, expense: 0 }); const dayData = dataMap.get(dateKey)!; let daySales = 0; t.payments.forEach(p => { if (p.method !== PaymentMethod.CREDIT) daySales += p.amountInUSD; }); dayData.sales += daySales; });
      transactions.forEach(t => { if (t.debtPayments) { t.debtPayments.forEach(dp => { if (dp.timestamp && dp.timestamp >= dateRange.start && dp.timestamp <= dateRange.end) { const dateKey = new Date(dp.timestamp).toLocaleDateString(); if(!dataMap.has(dateKey)) dataMap.set(dateKey, { date: dateKey, sales: 0, expense: 0 }); dataMap.get(dateKey)!.sales += dp.amountInUSD; } }); } });
      filteredExpenses.forEach(e => { const dateKey = new Date(e.timestamp).toLocaleDateString(); if(!dataMap.has(dateKey)) dataMap.set(dateKey, { date: dateKey, sales: 0, expense: 0 }); dataMap.get(dateKey)!.expense += e.amountUSD; });
      return Array.from(dataMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(item => ({ ...item, sales: item.sales * (currencyMode === 'VES' ? currentRate : 1), expense: item.expense * (currencyMode === 'VES' ? currentRate : 1), displayDate: item.date.split('/').slice(0, 2).join('/') }));
  }, [filteredTransactions, filteredExpenses, transactions, dateRange, currencyMode, currentRate]);

  const currencyDistribution = useMemo(() => {
      let hardCurrency = 0; let localCurrency = 0;
      const addToDist = (method: PaymentMethod, amountUSD: number) => { if (method === PaymentMethod.USD_CASH || method === PaymentMethod.USDT) { hardCurrency += amountUSD; } else if (method === PaymentMethod.VES_CASH || method === PaymentMethod.VES_PAGO_MOVIL) { localCurrency += amountUSD; } };
      filteredTransactions.forEach(t => { t.payments.forEach(p => addToDist(p.method, p.amountInUSD)); });
      transactions.forEach(t => { t.debtPayments?.forEach(dp => { if (dp.timestamp && dp.timestamp >= dateRange.start && dp.timestamp <= dateRange.end) { addToDist(dp.method, dp.amountInUSD); } }); });
      const total = hardCurrency + localCurrency; if (total === 0) return [];
      return [ { name: 'Divisa Dura ($/USDT)', value: hardCurrency * (currencyMode === 'VES' ? currentRate : 1) }, { name: 'Moneda Local (Bs)', value: localCurrency * (currencyMode === 'VES' ? currentRate : 1) } ];
  }, [filteredTransactions, transactions, dateRange, currencyMode, currentRate]);

  const debts = useMemo(() => {
      return transactions.filter(t => !t.isPaid && t.payments.some(p => p.method === PaymentMethod.CREDIT)).map(t => { const creditPayment = t.payments.find(p => p.method === PaymentMethod.CREDIT); const initialDebt = creditPayment ? creditPayment.amountInUSD : 0; const alreadyPaid = t.debtPayments?.reduce((sum, p) => sum + p.amountInUSD, 0) || 0; const remaining = initialDebt - alreadyPaid; if (remaining <= 0.01) return null; return { ...t, debtAmount: remaining }; }).filter(t => t !== null) as (Transaction & { debtAmount: number })[];
  }, [transactions]);

  const clientDetails = useMemo(() => {
    if (!viewingClient) return null;
    const clientTx = transactions.filter(t => (t.clientId && t.clientId === viewingClient.id) || (!t.clientId && t.clientName?.toLowerCase() === viewingClient.name.toLowerCase()));
    clientTx.sort((a, b) => b.timestamp - a.timestamp);
    const totalSpent = clientTx.reduce((sum, t) => sum + t.totalUSD, 0);
    let currentDebt = 0;
    clientTx.forEach(t => { const creditPayment = t.payments.find(p => p.method === PaymentMethod.CREDIT); if (creditPayment) { const debtAmount = creditPayment.amountInUSD; const paidAmount = t.debtPayments?.reduce((sum, p) => sum + p.amountInUSD, 0) || 0; currentDebt += Math.max(0, debtAmount - paidAmount); } });
    return { transactions: clientTx, totalSpent, currentDebt };
  }, [viewingClient, transactions]);

  const formatMoney = (amountUSD: number) => currencyMode === 'USD' ? `$${amountUSD.toFixed(2)}` : `Bs. ${(amountUSD * currentRate).toFixed(2)}`;
  const multiplier = currencyMode === 'USD' ? 1 : currentRate;

  const topProducts = useMemo(() => {
    const productMap = new Map<string, { name: string, qty: number, revenue: number }>();
    filteredTransactions.forEach(t => { t.items.forEach(item => { const current = productMap.get(item.id) || { name: item.name, qty: 0, revenue: 0 }; productMap.set(item.id, { name: item.name, qty: current.qty + item.quantity, revenue: current.revenue + (item.quantity * item.priceUSD) }); }); });
    return Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [filteredTransactions]);

  const handleEditClient = (client: Client) => { setEditingClientId(client.id); setClientFormData(client); };
  const handleCreateClient = () => { setEditingClientId('NEW'); setClientFormData({ id: Date.now().toString(), name: '', docId: '', phone: '', address: '' }); };
  const handleSaveClientForm = () => { if(!clientFormData.name) return; onSaveClient(clientFormData); setEditingClientId(null); };

  const handleAddExpense = () => { if (!newExpense.desc || !newExpense.amount || !newExpense.accountId) return; let timestamp = Date.now(); if (expenseDate) { const [year, month, day] = expenseDate.split('-').map(Number); const now = new Date(); const customDateObj = new Date(year, month - 1, day, now.getHours(), now.getMinutes()); timestamp = customDateObj.getTime(); } const inputAmount = parseFloat(newExpense.amount); const selectedAccount = accounts.find(a => a.id === newExpense.accountId); let finalAmountUSD = 0; let finalAmountPaid = 0; if (expenseCurrency === 'USD') { finalAmountUSD = inputAmount; finalAmountPaid = selectedAccount?.type === 'USD' ? inputAmount : inputAmount * currentRate; } else { finalAmountUSD = inputAmount / currentRate; finalAmountPaid = selectedAccount?.type === 'VES' ? inputAmount : inputAmount / currentRate; } onAddExpense({ id: Date.now().toString(), description: `${newExpense.desc} (${expenseCurrency === 'USD' ? '$' : 'Bs.'}${inputAmount})`, amountUSD: finalAmountUSD, amountPaid: finalAmountPaid, category: 'Gasto', timestamp: timestamp, accountId: newExpense.accountId }); setNewExpense({ desc: '', amount: '', accountId: '' }); setExpenseDate(''); };
  const handleCreateInv = () => { setEditingInvId('NEW'); setInvFormData({ id: `inv_${Date.now()}`, name: '', quantity: 0, unit: 'hojas' }); };
  const handleEditInv = (item: InventoryItem) => { setEditingInvId(item.id); setInvFormData({ ...item }); };
  const handleSaveInv = () => { if (!invFormData.name) return; let newInventory = [...inventory]; if (editingInvId === 'NEW') { newInventory.push(invFormData); } else { newInventory = newInventory.map(i => i.id === editingInvId ? invFormData : i); } onUpdateInventory(newInventory); setEditingInvId(null); };
  const openRestockForm = (item: InventoryItem) => { const today = new Date(); const localToday = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; setRestockData({ id: item.id, itemName: item.name, qty: '', cost: '', accountId: '', date: localToday }); setShowRestockForm(true); };
  const handleRestockSubmit = () => { if (!restockData.qty || !restockData.accountId || !restockData.cost) return; const qty = parseFloat(restockData.qty); const cost = parseFloat(restockData.cost); const account = accounts.find(a => a.id === restockData.accountId); const costInAccountCurrency = cost; const costInUSD = account?.type === 'VES' ? cost / currentRate : cost; const today = new Date(); const localToday = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; const finalDate = restockData.date === localToday ? undefined : restockData.date; onRestock(restockData.id, qty, costInUSD, restockData.accountId, costInAccountCurrency, finalDate); setRestockData({ id: '', itemName: '', qty: '', cost: '', accountId: '', date: '' }); setShowRestockForm(false); };
  const handleAdjustmentSubmit = () => { if (!adjustmentData.accountId || !adjustmentData.amount) return; const amount = parseFloat(adjustmentData.amount); const finalAmount = adjustmentData.type === 'IN' ? amount : -amount; onManualAdjustment(adjustmentData.accountId, finalAmount); setAdjustmentData({ accountId: '', amount: '', type: 'IN' }); setShowAdjustmentForm(false); };
  const openDebtPayment = (tx: Transaction & { debtAmount: number }) => { setDebtPaymentModal({ isOpen: true, txId: tx.id, clientName: tx.clientName || 'Cliente', remainingDebtUSD: tx.debtAmount, amount: '', method: PaymentMethod.USD_CASH, accountId: '', currency: 'USD', markAsPaid: false }); };
  const handleDebtPaymentSubmit = (shouldPrint: boolean) => { if(!debtPaymentModal || !debtPaymentModal.amount || !debtPaymentModal.accountId) return; const amount = parseFloat(debtPaymentModal.amount); if(isNaN(amount) || amount <= 0) return; let amountInUSD = amount; if(debtPaymentModal.currency === 'VES') { amountInUSD = amount / currentRate; } if(amountInUSD > debtPaymentModal.remainingDebtUSD + 0.05) { alert("El monto no puede ser mayor a la deuda restante."); return; } const payment: TransactionPayment = { method: debtPaymentModal.method as PaymentMethod, amount: amount, amountInUSD: amountInUSD }; onRegisterDebtPayment(debtPaymentModal.txId, payment, debtPaymentModal.accountId, debtPaymentModal.markAsPaid, shouldPrint); setDebtPaymentModal(null); };
  const handleForgiveDebt = () => { if(!debtPaymentModal) return; if(confirm("¿Seguro que deseas perdonar el resto de esta deuda? No se registrará ingreso de dinero.")) { const zeroPayment: TransactionPayment = { method: PaymentMethod.CREDIT, amount: 0, amountInUSD: 0 }; onRegisterDebtPayment(debtPaymentModal.txId, zeroPayment, "", true, false); setDebtPaymentModal(null); } }
  const openEditTx = (tx: Transaction) => { const dateStr = new Date(tx.timestamp).toISOString().split('T')[0]; setEditingTxId(tx.id); setEditTxData({ date: dateStr, clientName: tx.clientName || '', clientDoc: tx.clientDoc || '', payments: tx.payments.map(p => ({ ...p })) }); };
  const handleSaveTx = () => { if(!editingTxId) return; const originalTx = transactions.find(t => t.id === editingTxId); if(!originalTx) return; const originalDate = new Date(originalTx.timestamp); const newDatePart = new Date(editTxData.date); const userTimezoneOffset = newDatePart.getTimezoneOffset() * 60000; const newTimestamp = new Date(newDatePart.getTime() + userTimezoneOffset).setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds()); const updatedTx: Transaction = { ...originalTx, timestamp: newTimestamp, clientName: editTxData.clientName, clientDoc: editTxData.clientDoc, payments: editTxData.payments }; onUpdateTransaction(updatedTx); setEditingTxId(null); };
  const handleSavePin = () => { if (newPin.length > 0 && newPin.length < 4) { alert("El PIN debe tener al menos 4 dígitos"); return; } onSaveSettings({ ...settings, adminPin: newPin }); setNewPin(''); alert(newPin ? "PIN de seguridad actualizado." : "PIN eliminado. Acceso libre."); };
  const handleExportExcel = () => { const wb = XLSX.utils.book_new(); const txData = filteredTransactions.map(t => ({ ID: t.id, Fecha: new Date(t.timestamp).toLocaleString(), Cliente: t.clientName || 'Consumidor Final', 'Doc Cliente': t.clientDoc || '', 'Total USD': t.totalUSD, 'Total Bs': (t.totalUSD * t.rateUsed).toFixed(2), 'Tasa': t.rateUsed, 'Métodos': t.payments.map(p => `${p.method} ($${p.amountInUSD.toFixed(2)})`).join(', '), 'Items': t.items.map(i => `${i.quantity}x ${i.name}`).join('; ') })); const wsTx = XLSX.utils.json_to_sheet(txData); XLSX.utils.book_append_sheet(wb, wsTx, "Ventas Filtradas"); const expData = filteredExpenses.map(e => ({ Fecha: new Date(e.timestamp).toLocaleDateString(), Descripción: e.description, Categoría: e.category, 'Monto USD': e.amountUSD, 'Cuenta Origen': accounts.find(a => a.id === e.accountId)?.name || e.accountId })); const wsExp = XLSX.utils.json_to_sheet(expData); XLSX.utils.book_append_sheet(wb, wsExp, "Gastos Filtrados"); const invData = inventory.map(i => ({ Material: i.name, Cantidad: i.quantity, Unidad: i.unit })); const wsInv = XLSX.utils.json_to_sheet(invData); XLSX.utils.book_append_sheet(wb, wsInv, "Inventario Actual"); XLSX.writeFile(wb, `Reporte_SerendipiAPP_${new Date().toISOString().split('T')[0]}.xlsx`); };
  const handleExportPDF = () => { const doc = new jsPDF(); doc.setTextColor(40); doc.setFontSize(18); doc.text("Reporte SerendipiAPP", 14, 22); doc.setFontSize(10); doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 30); doc.text(`Filtro: ${filterType === 'custom' ? `Del ${new Date(dateRange.start).toLocaleDateString()} al ${new Date(dateRange.end).toLocaleDateString()}` : filterType.toUpperCase()}`, 14, 35); doc.setDrawColor(200); doc.setFillColor(245, 245, 245); doc.rect(14, 40, 180, 25, 'F'); doc.setFontSize(12); doc.setTextColor(0); doc.text("Resumen Financiero", 18, 50); doc.setFontSize(10); doc.text(`Ventas: $${stats.totalSalesUSD.toFixed(2)}`, 18, 58); doc.text(`Gastos: -$${stats.totalExpensesUSD.toFixed(2)}`, 80, 58); doc.text(`Neto: $${stats.netIncomeUSD.toFixed(2)}`, 140, 58); const tableColumn = ["Fecha", "Cliente", "Total ($)", "Detalles"]; const tableRows = filteredTransactions.map(t => [new Date(t.timestamp).toLocaleDateString(), t.clientName || '-', `$${t.totalUSD.toFixed(2)}`, t.items.map(i => `${i.quantity} ${i.name}`).join(', ').slice(0, 30) + '...']); autoTable(doc, { head: [tableColumn], body: tableRows, startY: 70, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] } }); doc.save(`Reporte_PDF_${new Date().toISOString().split('T')[0]}.pdf`); };
  const handleExport = () => { const backup: BackupData = { products, inventory, transactions, expenses, rates, accounts, transfers, clients, settings, exportDate: Date.now(), version: '1.4' }; const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `serendipia_backup_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
  const handleImportClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); setConfirmAction({ type: 'IMPORT', data }); } catch (err) { alert('Error al leer el archivo'); } }; reader.readAsText(file); };
  const executeConfirmation = () => { if (!confirmAction) return; if (confirmAction.type === 'VOID' && confirmAction.id) { onVoidTransaction(confirmAction.id); } else if (confirmAction.type === 'RESTORE' && confirmAction.id) { onRestoreTransaction(confirmAction.id); onClose(); } else if (confirmAction.type === 'DELETE_INV' && confirmAction.id) { onUpdateInventory(inventory.filter(i => i.id !== confirmAction.id)); } else if (confirmAction.type === 'IMPORT' && confirmAction.data) { onImportData(confirmAction.data); alert('Datos restaurados.'); onClose(); } setConfirmAction(null); };
  const paymentData = [ { name: 'USD Cash', value: (stats.methodBreakdown[PaymentMethod.USD_CASH] || 0) * multiplier }, { name: 'USDT', value: (stats.methodBreakdown[PaymentMethod.USDT] || 0) * multiplier }, { name: 'Pago Móvil', value: (stats.methodBreakdown[PaymentMethod.VES_PAGO_MOVIL] || 0) * multiplier }, { name: 'Bs Cash', value: (stats.methodBreakdown[PaymentMethod.VES_CASH] || 0) * multiplier }, { name: 'Fiado', value: (stats.methodBreakdown[PaymentMethod.CREDIT] || 0) * multiplier }, ].filter(d => d.value > 0);

  // New Treasury Stats
  const totalHeldUSD = useMemo(() => accounts.filter(a => a.type === 'USD').reduce((acc, curr) => acc + curr.balance, 0), [accounts]);
  const totalHeldVES = useMemo(() => accounts.filter(a => a.type === 'VES').reduce((acc, curr) => acc + curr.balance, 0), [accounts]);

  const [transferData, setTransferData] = useState<{ fromId: string; toId: string; amount: string; fee: string; feeCurrency: 'USD' | 'VES'; rate: string; date: string; note: string }>({ fromId: '', toId: '', amount: '', fee: '', feeCurrency: 'USD', rate: currentRate.toString(), date: '', note: '' });
  useEffect(() => { setTransferData(prev => ({ ...prev, rate: currentRate.toString() })); }, [currentRate]);
  const transferPreview = useMemo(() => {
      const fromAcc = accounts.find(a => a.id === transferData.fromId);
      const toAcc = accounts.find(a => a.id === transferData.toId);
      const amount = parseFloat(transferData.amount) || 0;
      const rate = parseFloat(transferData.rate) || currentRate;
      if (!fromAcc || !toAcc || amount <= 0) return { amountTo: 0, feeInSource: 0 };
      let amountTo = amount;
      if (fromAcc.type !== toAcc.type) {
          if (fromAcc.type === 'USD' && toAcc.type === 'VES') amountTo = amount * rate;
          else if (fromAcc.type === 'VES' && toAcc.type === 'USD') amountTo = amount / rate;
      }
      let feeInSource = 0;
      const fee = parseFloat(transferData.fee) || 0;
      const fCurr = transferData.feeCurrency || fromAcc.type;
      if (fee > 0) {
          if (fromAcc.type === fCurr) feeInSource = fee;
          else {
              if (fromAcc.type === 'USD' && fCurr === 'VES') feeInSource = fee / rate;
              else if (fromAcc.type === 'VES' && fCurr === 'USD') feeInSource = fee * rate;
          }
      }
      return { amountTo, feeInSource };
  }, [transferData, accounts, currentRate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 no-print">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col relative transition-colors duration-200">
        
        {/* Overlays... (Same as before) */}
        {showRestockForm && (
            <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 rounded-lg">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in duration-200 border dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2"><ShoppingCart className="text-green-600" /> Registrar Compra</h3>
                    <p className="text-sm text-gray-500 mb-4">Reponer inventario de: <span className="font-bold text-gray-800 dark:text-gray-200">{restockData.itemName}</span></p>
                    <div className="space-y-3">
                        <div className="flex justify-between gap-2">
                            <div className="w-1/2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Compra</label>
                                <input type="date" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={restockData.date} onChange={e => setRestockData({...restockData, date: e.target.value})} />
                            </div>
                            <div className="w-1/2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad</label>
                                <input type="number" autoFocus className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ej: 500" value={restockData.qty} onChange={e => setRestockData({...restockData, qty: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Costo Total Pagado</label>
                            <input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="0.00" value={restockData.cost} onChange={e => setRestockData({...restockData, cost: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pagado Desde</label>
                            <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={restockData.accountId} onChange={e => setRestockData({...restockData, accountId: e.target.value})} >
                                <option value="">Seleccione Cuenta...</option>
                                {accounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.type}) - Disp: {acc.type === 'USD' ? '$' : 'Bs'}{acc.balance.toFixed(2)}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full mt-6">
                        <button onClick={() => setShowRestockForm(false)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg">Cancelar</button>
                        <button onClick={handleRestockSubmit} disabled={!restockData.qty || !restockData.cost || !restockData.accountId} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50">Confirmar Compra</button>
                    </div>
                </div>
            </div>
        )}
        {debtPaymentModal && debtPaymentModal.isOpen && (
            <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 rounded-lg">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full animate-in zoom-in duration-200 border dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><DollarSign className="text-green-600" /> Abonar a Deuda</h3>
                    <p className="text-sm text-gray-500 mb-4">Cliente: <span className="font-bold text-gray-800 dark:text-gray-200">{debtPaymentModal.clientName}</span></p>
                    <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded flex justify-between items-center">
                        <div>
                            <p className="text-xs text-orange-600 dark:text-orange-300 uppercase font-bold">Deuda Pendiente</p>
                            <p className="text-xl font-bold text-orange-800 dark:text-orange-200">{debtPaymentModal.currency === 'USD' ? '$' : 'Bs.'}{(debtPaymentModal.remainingDebtUSD * (debtPaymentModal.currency === 'USD' ? 1 : currentRate)).toFixed(2)}</p>
                        </div>
                        <div className="flex bg-white dark:bg-gray-700 rounded border dark:border-gray-600">
                            <button onClick={() => setDebtPaymentModal({...debtPaymentModal, currency: 'USD'})} className={`px-3 py-1 text-xs font-bold rounded-l ${debtPaymentModal.currency === 'USD' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'text-gray-500'}`}>USD</button>
                            <button onClick={() => setDebtPaymentModal({...debtPaymentModal, currency: 'VES'})} className={`px-3 py-1 text-xs font-bold rounded-r ${debtPaymentModal.currency === 'VES' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-500'}`}>Bs</button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto a Pagar ({debtPaymentModal.currency})</label>
                            <div className="flex gap-2">
                                <input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="0.00" value={debtPaymentModal.amount} onChange={e => setDebtPaymentModal({...debtPaymentModal, amount: e.target.value})} autoFocus />
                                <button onClick={() => setDebtPaymentModal({...debtPaymentModal, amount: (debtPaymentModal.remainingDebtUSD * (debtPaymentModal.currency === 'USD' ? 1 : currentRate)).toFixed(2)})} className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 rounded text-xs font-bold hover:bg-blue-200">TODO</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Pago</label>
                            <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={debtPaymentModal.method} onChange={e => setDebtPaymentModal({...debtPaymentModal, method: e.target.value})} >
                                <option value={PaymentMethod.USD_CASH}>Efectivo USD</option>
                                <option value={PaymentMethod.VES_PAGO_MOVIL}>Pago Móvil (Bs)</option>
                                <option value={PaymentMethod.VES_CASH}>Efectivo Bs</option>
                                <option value={PaymentMethod.USDT}>Binance USDT</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cuenta Destino</label>
                            <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={debtPaymentModal.accountId} onChange={e => setDebtPaymentModal({...debtPaymentModal, accountId: e.target.value})} >
                                <option value="">Seleccione Cuenta...</option>
                                {accounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <input type="checkbox" id="markPaid" className="w-4 h-4 rounded text-green-600 focus:ring-green-500" checked={debtPaymentModal.markAsPaid} onChange={e => setDebtPaymentModal({...debtPaymentModal, markAsPaid: e.target.checked})} />
                            <label htmlFor="markPaid" className="text-xs text-gray-600 dark:text-gray-300 font-medium cursor-pointer">Dar por saldada (Cerrar deuda aunque el monto sea menor)</label>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 w-full mt-6">
                        <div className="flex gap-2">
                            <button onClick={() => setDebtPaymentModal(null)} className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs">Cancelar</button>
                            <button onClick={() => handleDebtPaymentSubmit(false)} disabled={!debtPaymentModal.amount || !debtPaymentModal.accountId} className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50 text-xs">Registrar</button>
                            <button onClick={() => handleDebtPaymentSubmit(true)} disabled={!debtPaymentModal.amount || !debtPaymentModal.accountId} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50 text-xs flex items-center justify-center gap-1"><Printer size={12}/> + Print</button>
                        </div>
                        <button onClick={handleForgiveDebt} className="w-full text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 rounded flex justify-center items-center gap-1 mt-1 transition"><Ban size={12} /> Perdonar / Anular Restante</button>
                    </div>
                </div>
            </div>
        )}
        {editingTxId && (
            <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 rounded-lg">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-lg w-full animate-in zoom-in duration-200 border dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Edit2 className="text-blue-600" /> Editar Registro</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                            <input type="date" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={editTxData.date} onChange={e => setEditTxData({...editTxData, date: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente</label>
                                <input className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={editTxData.clientName} onChange={e => setEditTxData({...editTxData, clientName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CI / RIF</label>
                                <input className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={editTxData.clientDoc} onChange={e => setEditTxData({...editTxData, clientDoc: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Métodos de Pago y Referencias</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto p-1">
                                {editTxData.payments.map((p, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                        <span className="text-xs font-bold w-1/3 dark:text-white">{p.method}</span>
                                        <span className="text-xs text-gray-500 w-1/4">${p.amountInUSD.toFixed(2)}</span>
                                        <input className="flex-1 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Referencia" value={p.reference || ''} onChange={(e) => { const newPayments = [...editTxData.payments]; newPayments[idx] = { ...newPayments[idx], reference: e.target.value }; setEditTxData({ ...editTxData, payments: newPayments }); }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full mt-6">
                        <button onClick={() => setEditingTxId(null)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg">Cancelar</button>
                        <button onClick={handleSaveTx} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        )}
        {confirmAction && (
             <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 rounded-lg">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full animate-in zoom-in duration-200 border dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 text-center">Confirmar Acción</h3>
                    <div className="flex gap-3 w-full mt-4">
                        <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg">Cancelar</button>
                        <button onClick={executeConfirmation} className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg">Confirmar</button>
                    </div>
                </div>
            </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Calendar size={20}/> Panel de Control
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl px-2">&times;</button>
        </div>

        {/* Filters & Actions Bar */}
        {activeTab !== 'data' && activeTab !== 'treasury' && activeTab !== 'debts' && activeTab !== 'clients' && activeTab !== 'inventory' && (
          <div className="p-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex flex-col lg:flex-row gap-4 items-center justify-between">
             <div className="flex gap-2 overflow-x-auto pb-1 w-full lg:w-auto items-center">
                 <button onClick={() => setFilterType('today')} className={`px-3 py-1 rounded text-sm ${filterType === 'today' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Hoy</button>
                 <button onClick={() => setFilterType('week')} className={`px-3 py-1 rounded text-sm ${filterType === 'week' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Semana</button>
                 <button onClick={() => setFilterType('month')} className={`px-3 py-1 rounded text-sm ${filterType === 'month' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Mes</button>
                 <button onClick={() => setFilterType('custom')} className={`px-3 py-1 rounded text-sm ${filterType === 'custom' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Rango</button>
                 
                 {filterType === 'custom' && (
                    <div className="flex items-center gap-2 animate-in fade-in">
                        <input type="date" className="p-1 border rounded text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                        <span className="text-gray-400">-</span>
                        <input type="date" className="p-1 border rounded text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                    </div>
                 )}
             </div>
             <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
                <button onClick={() => setCurrencyMode('USD')} className={`px-3 py-1 text-xs font-bold rounded-md ${currencyMode === 'USD' ? 'bg-white dark:bg-gray-600 text-green-600' : 'text-gray-400'}`}>USD</button>
                <button onClick={() => setCurrencyMode('VES')} className={`px-3 py-1 text-xs font-bold rounded-md ${currencyMode === 'VES' ? 'bg-white dark:bg-gray-600 text-blue-600' : 'text-gray-400'}`}>Bs</button>
             </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700 overflow-x-auto no-scrollbar sticky top-0 bg-white dark:bg-gray-800 z-10">
            <button onClick={() => setActiveTab('overview')} className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm flex justify-center items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'border-b-2 border-primary text-primary dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><DollarSign size={16} /> Resumen</button>
            <button onClick={() => setActiveTab('transactions')} className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm flex justify-center items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'transactions' ? 'border-b-2 border-primary text-primary dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><List size={16} /> Ventas</button>
            <button onClick={() => setActiveTab('clients')} className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm flex justify-center items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'clients' ? 'border-b-2 border-primary text-primary dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Users size={16} /> Clientes</button>
            <button onClick={() => setActiveTab('debts')} className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm flex justify-center items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'debts' ? 'border-b-2 border-primary text-primary dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><User size={16} /> Deudas</button>
            <button onClick={() => setActiveTab('treasury')} className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm flex justify-center items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'treasury' ? 'border-b-2 border-primary text-primary dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Wallet size={16} /> Caja</button>
            <button onClick={() => setActiveTab('expenses')} className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm flex justify-center items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'expenses' ? 'border-b-2 border-primary text-primary dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><ShoppingBag size={16} /> Gastos</button>
            <button onClick={() => setActiveTab('inventory')} className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm flex justify-center items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'inventory' ? 'border-b-2 border-primary text-primary dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Box size={16} /> Stock</button>
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm flex justify-center items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'data' ? 'border-b-2 border-primary text-primary dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Database size={16} /> Datos</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-gray-900/50">
            {activeTab === 'overview' && (
                 <div className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {/* Real-time Liquidity Card */}
                       <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl shadow-lg p-6 text-white transform transition-all hover:scale-[1.01]">
                            <div className="flex justify-between items-start">
                                 <div>
                                     <h4 className="text-blue-100 font-bold text-sm uppercase tracking-wider mb-1">Capital Total Disponible (Tiempo Real)</h4>
                                     <p className="text-xs text-blue-200 mb-2">Suma de todas las cuentas convertidas.</p>
                                     <div className="text-4xl font-extrabold flex items-baseline gap-2">
                                         {currencyMode === 'USD' ? '$' : 'Bs.'}{currentLiquidity.toFixed(2)}
                                     </div>
                                 </div>
                                 <div className="bg-white/20 p-3 rounded-full">
                                     <Wallet size={32} className="text-white" />
                                 </div>
                            </div>
                       </div>
                       {/* Collection Efficiency Card */}
                       <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border dark:border-gray-700 flex flex-col justify-between">
                           <div className="flex justify-between items-start mb-2">
                               <div>
                                   <h4 className="text-gray-500 dark:text-gray-400 font-bold text-sm uppercase tracking-wider">Eficiencia de Cobranza</h4>
                                   <p className="text-xs text-gray-400 mb-2">Total Fiado vs. Total Recuperado (Histórico)</p>
                               </div>
                               <div className={`p-2 rounded-full ${efficiencyStats.efficiency >= 80 ? 'bg-green-100 text-green-600' : efficiencyStats.efficiency >= 50 ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                                   <Activity size={24} />
                               </div>
                           </div>
                           <div>
                               <div className="flex justify-between text-sm font-bold mb-1 dark:text-white">
                                   <span>{efficiencyStats.efficiency.toFixed(1)}% Recuperado</span>
                                   <span>${efficiencyStats.paid.toFixed(2)} / ${efficiencyStats.issued.toFixed(2)}</span>
                               </div>
                               <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                   <div 
                                       className={`h-2.5 rounded-full transition-all duration-1000 ${efficiencyStats.efficiency >= 80 ? 'bg-green-600' : efficiencyStats.efficiency >= 50 ? 'bg-orange-500' : 'bg-red-600'}`} 
                                       style={{ width: `${Math.min(100, efficiencyStats.efficiency)}%` }}
                                   ></div>
                               </div>
                           </div>
                       </div>
                   </div>

                   {/* Main Stats Rows */}
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-bold uppercase">Ventas Cobradas (Líquido)</p>
                            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatMoney(stats.totalSalesUSD)}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-100 dark:border-orange-900/30">
                             <p className="text-sm text-orange-600 dark:text-orange-400 font-bold uppercase">Cuentas por Cobrar</p>
                             <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">{formatMoney(stats.totalDebtUSD)}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-900/30">
                            <p className="text-sm text-red-600 dark:text-red-400 font-bold uppercase">Gastos Totales</p>
                            <p className="text-2xl font-bold text-red-800 dark:text-red-200">-{formatMoney(stats.totalExpensesUSD)}</p>
                        </div>
                        <div className={`p-4 rounded-lg border ${stats.netIncomeUSD >= 0 ? 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                            <p className={`text-sm font-bold uppercase ${stats.netIncomeUSD >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>Ganancia Operativa (Flujo)</p>
                            <p className={`text-2xl font-bold ${stats.netIncomeUSD >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>{formatMoney(stats.netIncomeUSD)}</p>
                         </div>
                   </div>

                   {/* Charts Row 1: Trend & Income vs Expenses */}
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700 shadow-sm flex flex-col h-[300px]">
                            <h3 className="text-lg font-semibold mb-2 dark:text-white flex items-center gap-2"><TrendingUp size={20} className="text-blue-500" /> Tendencia de Ventas</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="displayDate" axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#6b7280'}} />
                                        <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#6b7280'}} tickFormatter={(val) => `${val}`} />
                                        <Tooltip 
                                            formatter={(value: number) => [currencyMode === 'USD' ? `$${value.toFixed(2)}` : `Bs.${value.toFixed(2)}`, "Ventas"]}
                                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        />
                                        <Area type="monotone" dataKey="sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700 shadow-sm flex flex-col h-[300px]">
                            <h3 className="text-lg font-semibold mb-2 dark:text-white flex items-center gap-2"><ArrowRightLeft size={20} className="text-purple-500" /> Ingresos vs. Gastos</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="displayDate" axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#6b7280'}} />
                                        <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#6b7280'}} />
                                        <Tooltip 
                                            cursor={{fill: 'transparent'}}
                                            formatter={(value: number, name: string) => [currencyMode === 'USD' ? `$${value.toFixed(2)}` : `Bs.${value.toFixed(2)}`, name === 'sales' ? 'Ingresos' : 'Gastos']}
                                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        />
                                        <Legend wrapperStyle={{paddingTop: '10px'}} />
                                        <Bar name="Ingresos" dataKey="sales" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar name="Gastos" dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                   </div>

                   {/* Charts Row 2: Currency & Methods */}
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700 shadow-sm flex flex-col items-center h-[300px]">
                            <h3 className="text-lg font-semibold mb-4 w-full text-left dark:text-white flex items-center gap-2"><DollarSign size={20} className="text-green-600" /> Distribución de Divisas</h3>
                            <div className="flex-1 w-full min-h-0 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={currencyDistribution} 
                                            cx="50%" cy="50%" 
                                            innerRadius={60} outerRadius={80} 
                                            paddingAngle={2} dataKey="value"
                                            stroke="none"
                                        >
                                        {currencyDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={CURRENCY_COLORS[index % CURRENCY_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => currencyMode === 'USD' ? `$${value.toFixed(2)}` : `Bs.${value.toFixed(2)}`} />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500">REALIDAD</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700 shadow-sm flex flex-col items-center h-[300px]">
                            <h3 className="text-lg font-semibold mb-4 w-full text-left dark:text-white flex items-center gap-2"><Wallet size={20} className="text-orange-500" /> Métodos de Pago</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={paymentData} 
                                            cx="50%" cy="50%" 
                                            innerRadius={0} outerRadius={80} 
                                            paddingAngle={2} dataKey="value"
                                            stroke="none"
                                        >
                                        {paymentData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => currencyMode === 'USD' ? `$${value.toFixed(2)}` : `Bs.${value.toFixed(2)}`} />
                                        <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{fontSize: '10px'}}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700 shadow-sm flex flex-col h-[300px]">
                            <h3 className="text-lg font-semibold mb-4 dark:text-white flex items-center gap-2"><Award size={20} className="text-yellow-500" /> Top Productos</h3>
                            <div className="flex-1 overflow-y-auto pr-2">
                                <ul className="space-y-3">
                                    {topProducts.map((p, idx) => (
                                        <li key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded hover:bg-gray-100 transition border-l-4 border-blue-500">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shadow-sm">{idx + 1}</div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200 line-clamp-1">{p.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.qty} vendidos</p>
                                                </div>
                                            </div>
                                            <p className="font-bold text-sm text-gray-700 dark:text-gray-300">{formatMoney(p.revenue * (currencyMode === 'VES' ? 1/currentRate : 1))}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                   </div>
               </div>
            )}
            
            {activeTab === 'transactions' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h3 className="text-lg font-semibold dark:text-white">Historial de Ventas</h3>
                        <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex gap-1">
                            <button onClick={() => setReprintMode('MIXED')} className={`px-2 py-1 text-xs font-bold rounded ${reprintMode === 'MIXED' ? 'bg-white dark:bg-gray-600 shadow' : 'text-gray-500'}`}>Mixto</button>
                            <button onClick={() => setReprintMode('USD')} className={`px-2 py-1 text-xs font-bold rounded ${reprintMode === 'USD' ? 'bg-white dark:bg-gray-600 shadow text-green-600' : 'text-gray-500'}`}>$</button>
                            <button onClick={() => setReprintMode('VES')} className={`px-2 py-1 text-xs font-bold rounded ${reprintMode === 'VES' ? 'bg-white dark:bg-gray-600 shadow text-blue-600' : 'text-gray-500'}`}>Bs</button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col h-[500px]">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 dark:bg-gray-700 uppercase text-xs text-gray-700 dark:text-gray-300 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Detalle</th>
                                        <th className="px-4 py-3 text-right">Total USD</th>
                                        <th className="px-4 py-3 text-right">Total Bs</th>
                                        <th className="px-4 py-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {paginatedTransactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3">{new Date(tx.timestamp).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                {tx.items?.map(i => <div key={i.id}>{i.quantity}x {i.name}</div>)}
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {tx.payments?.map(p => `${p.method} ${p.reference ? `(#${p.reference.slice(-4)})` : ''}`).join(', ')}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-600">${tx.totalUSD.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right font-medium text-blue-600">Bs. {(tx.totalUSD * tx.rateUsed).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center flex justify-center gap-2">
                                                <button onClick={() => openEditTx(tx)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title="Editar"><Pencil size={16}/></button>
                                                <button onClick={() => onReprintTransaction(tx, reprintMode)} className="text-gray-500 hover:bg-gray-100 p-1 rounded" title={`Reimprimir (${reprintMode})`}><Printer size={16}/></button>
                                                <button onClick={() => setConfirmAction({ type: 'VOID', id: tx.id })} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Anular"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedTransactions.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-8 text-gray-500">No hay transacciones en este rango.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalTxPages > 1 && (
                            <div className="p-3 border-t dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Página {currentPage} de {totalTxPages} ({filteredTransactions.length} registros)
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded bg-white dark:bg-gray-800 border dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft size={16} /></button>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalTxPages, p + 1))} disabled={currentPage === totalTxPages} className="p-1 rounded bg-white dark:bg-gray-800 border dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {activeTab === 'treasury' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold dark:text-white">Tesorería y Cuentas</h3>
                    
                    {/* New Aggregated Totals */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-xl shadow-lg">
                            <p className="text-xs font-bold uppercase opacity-80 mb-1">Total en Divisas ($)</p>
                            <div className="flex items-center gap-2">
                                <DollarSign size={28} />
                                <span className="text-3xl font-extrabold">{totalHeldUSD.toFixed(2)}</span>
                            </div>
                            <p className="text-xs mt-2 opacity-75">Suma de Cajas Fuertes, Binance, Zelle, etc.</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow-lg">
                            <p className="text-xs font-bold uppercase opacity-80 mb-1">Total en Bolívares (Bs)</p>
                            <div className="flex items-center gap-2">
                                <Banknote size={28} />
                                <span className="text-3xl font-extrabold">{totalHeldVES.toFixed(2)}</span>
                            </div>
                            <p className="text-xs mt-2 opacity-75">Suma de Bancos, Pago Móvil y Efectivo Bs.</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h4 className="font-bold mb-3 dark:text-white flex items-center gap-2"><ArrowRightLeft size={18} className="text-purple-600" /> Transferencia entre Cuentas</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desde</label>
                                <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={transferData.fromId} onChange={e => setTransferData({ ...transferData, fromId: e.target.value })}>
                                    <option value="">Seleccione...</option>
                                    {accounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hacia</label>
                                <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={transferData.toId} onChange={e => setTransferData({ ...transferData, toId: e.target.value })}>
                                    <option value="">Seleccione...</option>
                                    {accounts.filter(a => a.id !== transferData.fromId).map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto</label>
                                <input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="0.00" value={transferData.amount} onChange={e => setTransferData({ ...transferData, amount: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tasa</label>
                                <input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={transferData.rate} onChange={e => setTransferData({ ...transferData, rate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Comisión</label>
                                <div className="flex gap-2">
                                    <input type="number" step="0.01" className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="0.00" value={transferData.fee} onChange={e => setTransferData({ ...transferData, fee: e.target.value })} />
                                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
                                        <button onClick={() => setTransferData({ ...transferData, feeCurrency: 'USD' })} className={`px-2 py-1 text-xs font-bold rounded ${transferData.feeCurrency === 'USD' ? 'bg-white dark:bg-gray-600 text-green-600 shadow-sm' : 'text-gray-400'}`}>$</button>
                                        <button onClick={() => setTransferData({ ...transferData, feeCurrency: 'VES' })} className={`px-2 py-1 text-xs font-bold rounded ${transferData.feeCurrency === 'VES' ? 'bg-white dark:bg-gray-600 text-blue-600 shadow-sm' : 'text-gray-400'}`}>Bs</button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                                <input type="date" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={transferData.date} onChange={e => setTransferData({ ...transferData, date: e.target.value })} />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota</label>
                            <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Detalle de la transferencia (opcional)" value={transferData.note} onChange={e => setTransferData({ ...transferData, note: e.target.value })} />
                        </div>
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-xs">
                            <div className="flex flex-wrap gap-4">
                                <div>Destino recibirá: <span className="font-bold">{(() => { const toAcc = accounts.find(a => a.id === transferData.toId); if (!toAcc) return ''; const symbol = toAcc.type === 'USD' ? '$' : 'Bs.'; return `${symbol}${transferPreview.amountTo.toFixed(2)}`; })()}</span></div>
                                <div>Origen descuenta comisión: <span className="font-bold">{(() => { const fromAcc = accounts.find(a => a.id === transferData.fromId); if (!fromAcc) return ''; const symbol = fromAcc.type === 'USD' ? '$' : 'Bs.'; return `${symbol}${transferPreview.feeInSource.toFixed(2)}`; })()}</span></div>
                            </div>
                        </div>
                        <div className="flex gap-3 w-full mt-4">
                            <button onClick={() => setTransferData({ fromId: '', toId: '', amount: '', fee: '', feeCurrency: 'USD', rate: currentRate.toString(), date: '', note: '' })} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg">Limpiar</button>
                            <button onClick={() => { const amount = parseFloat(transferData.amount || '0'); const fee = parseFloat(transferData.fee || '0'); const rate = parseFloat(transferData.rate || currentRate.toString()); if (!transferData.fromId || !transferData.toId || isNaN(amount) || amount <= 0) return; onTransfer({ fromId: transferData.fromId, toId: transferData.toId, amount, fee, feeCurrency: transferData.feeCurrency, rate, note: transferData.note || undefined, customDate: transferData.date || undefined }); setTransferData({ fromId: '', toId: '', amount: '', fee: '', feeCurrency: 'USD', rate: currentRate.toString(), date: '', note: '' }); }} disabled={!transferData.fromId || !transferData.toId || !transferData.amount} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg disabled:opacity-50">Ejecutar Transferencia</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {accounts.map(acc => {
                            const isUsd = acc.type === 'USD';
                            const equivalent = isUsd ? acc.balance * currentRate : acc.balance / currentRate;
                            return (
                                <div key={acc.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-32">
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">{acc.name}</p>
                                        <p className={`text-2xl font-bold ${acc.type === 'USD' ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'}`}>{acc.type === 'USD' ? '$' : 'Bs. '}{acc.balance.toFixed(2)}</p>
                                        <p className="text-xs text-gray-400 font-medium mt-1">≈ {acc.type === 'USD' ? 'Bs. ' : '$'}{equivalent.toFixed(2)}</p>
                                    </div>
                                    <div className="mt-2 pt-2 border-t dark:border-gray-700">
                                        <button onClick={() => { setAdjustmentData({ ...adjustmentData, accountId: acc.id }); setShowAdjustmentForm(true); }} className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1 w-full justify-center"><Edit2 size={10} /> Ajuste Manual</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col mt-4">
                        <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                            <h4 className="font-bold text-sm dark:text-white flex items-center gap-2"><List size={16} /> Últimas Transferencias</h4>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{transfers.length} registros</span>
                        </div>
                        <div className="max-h-[240px] overflow-auto no-scrollbar">
                            <table className="w-full text-sm text-left min-w-[600px]">
                                <thead className="bg-gray-100 dark:bg-gray-700 uppercase text-xs text-gray-700 dark:text-gray-300 sticky top-0 z-10">
                                    <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Desde → Hacia</th><th className="px-4 py-3 text-right">Monto Origen</th><th className="px-4 py-3 text-right">Monto Destino</th><th className="px-4 py-3 text-right">Tasa</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {(transfers.slice().sort((a,b) => b.timestamp - a.timestamp)).slice(0, 10).map(t => {
                                        const from = accounts.find(a => a.id === t.fromAccountId);
                                        const to = accounts.find(a => a.id === t.toAccountId);
                                        const fromSym = from?.type === 'USD' ? '$' : 'Bs.';
                                        const toSym = to?.type === 'USD' ? '$' : 'Bs.';
                                        return (
                                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3">{new Date(t.timestamp).toLocaleString()}</td>
                                                <td className="px-4 py-3">{from?.name || t.fromAccountId} → {to?.name || t.toAccountId}</td>
                                                <td className="px-4 py-3 text-right font-medium">{fromSym}{t.amountFrom.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-bold">{toSym}{t.amountTo.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right">{t.rateUsed?.toFixed(2) || '-'}</td>
                                            </tr>
                                        )
                                    })}
                                    {transfers.length === 0 && (<tr><td colSpan={5} className="text-center py-8 text-gray-500">No hay transferencias registradas.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {showAdjustmentForm && (
                        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                             <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full border dark:border-gray-700">
                                <h4 className="font-bold mb-4 dark:text-white">Ajuste de Saldo Manual</h4>
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => setAdjustmentData({...adjustmentData, type: 'IN'})} className={`flex-1 py-2 rounded text-sm font-bold ${adjustmentData.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>Ingreso (+)</button>
                                        <button onClick={() => setAdjustmentData({...adjustmentData, type: 'OUT'})} className={`flex-1 py-2 rounded text-sm font-bold ${adjustmentData.type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>Retiro (-)</button>
                                    </div>
                                    <input type="number" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Monto" value={adjustmentData.amount} onChange={e => setAdjustmentData({...adjustmentData, amount: e.target.value})} autoFocus />
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => setShowAdjustmentForm(false)} className="flex-1 py-2 bg-gray-200 rounded text-sm">Cancelar</button>
                                        <button onClick={handleAdjustmentSubmit} className="flex-1 py-2 bg-primary text-white rounded text-sm font-bold">Guardar</button>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'expenses' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold dark:text-white">Registro de Gastos</h3>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700 mb-4">
                        <h4 className="font-bold text-sm mb-2 dark:text-white">Nuevo Gasto Vario</h4>
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <input type="date" className="flex-1 sm:w-32 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm h-10" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} placeholder="Hoy" />
                                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600 h-10 shrink-0">
                                    <button onClick={() => setExpenseCurrency('USD')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${expenseCurrency === 'USD' ? 'bg-white dark:bg-gray-600 text-green-600 shadow-sm' : 'text-gray-400'}`}>$</button>
                                    <button onClick={() => setExpenseCurrency('VES')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${expenseCurrency === 'VES' ? 'bg-white dark:bg-gray-600 text-blue-600 shadow-sm' : 'text-gray-400'}`}>Bs</button>
                                </div>
                            </div>
                            <input className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white h-10 text-sm" placeholder="Descripción (ej: Bolsas, Limpieza)" value={newExpense.desc} onChange={e => setNewExpense({...newExpense, desc: e.target.value})} />
                            <div className="flex gap-2 w-full sm:w-auto">
                                <input type="number" className="flex-1 sm:w-28 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white h-10 text-sm" placeholder={expenseCurrency === 'USD' ? "Monto ($)" : "Monto (Bs)"} value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                                <select className="flex-1 sm:w-40 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white h-10 text-sm" value={newExpense.accountId} onChange={e => setNewExpense({...newExpense, accountId: e.target.value})} >
                                    <option value="">Pagar de...</option>
                                    {accounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>))}
                                </select>
                            </div>
                            <button onClick={handleAddExpense} className="bg-red-500 text-white p-2 rounded hover:bg-red-600 font-bold flex items-center justify-center h-10 sm:w-10 grow sm:grow-0 transition-colors"><Plus size={20} className="sm:hidden mr-2"/> {window.innerWidth < 640 ? 'Agregar Gasto' : <Plus size={20}/>}</button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col h-[400px]">
                        <div className="flex-1 overflow-auto no-scrollbar">
                            <table className="w-full text-sm text-left min-w-[500px]">
                                <thead className="bg-gray-100 dark:bg-gray-700 uppercase text-xs text-gray-700 dark:text-gray-300 sticky top-0 z-10">
                                    <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3 text-center">Acciones</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {paginatedExpenses.map((exp) => (
                                        <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3">{new Date(exp.timestamp).toLocaleDateString()}</td>
                                            <td className="px-4 py-3">{exp.description}<span className="block text-xs text-gray-400">{exp.category}</span></td>
                                            <td className="px-4 py-3 text-right font-bold text-red-600">{formatMoney(exp.amountUSD)}</td>
                                            <td className="px-4 py-3 text-center"><button onClick={() => onDeleteExpense(exp.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                    {paginatedExpenses.length === 0 && (<tr><td colSpan={4} className="text-center py-8 text-gray-500">No hay gastos en este rango.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                        {totalExpPages > 1 && (
                            <div className="p-3 border-t dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Página {expCurrentPage} de {totalExpPages}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setExpCurrentPage(p => Math.max(1, p - 1))} disabled={expCurrentPage === 1} className="p-1 rounded bg-white dark:bg-gray-800 border dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft size={16} /></button>
                                    <button onClick={() => setExpCurrentPage(p => Math.min(totalExpPages, p + 1))} disabled={expCurrentPage === totalExpPages} className="p-1 rounded bg-white dark:bg-gray-800 border dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'clients' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center"><h3 className="text-lg font-semibold dark:text-white flex items-center gap-2"><Users size={20}/> Gestión de Clientes</h3><button onClick={handleCreateClient} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 text-sm font-bold shadow-sm" disabled={editingClientId !== null}><Plus size={18} /> Nuevo Cliente</button></div>
                    {viewingClient && clientDetails ? (
                        <div className="animate-in slide-in-from-right-4 fade-in">
                            <div className="flex items-center gap-4 mb-4">
                                <button onClick={() => setViewingClient(null)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"><ArrowLeft size={20} className="text-gray-600 dark:text-gray-200" /></button>
                                <div><h3 className="text-xl font-bold text-gray-800 dark:text-white">{viewingClient.name}</h3><p className="text-xs text-gray-500 dark:text-gray-400">{viewingClient.docId} {viewingClient.phone ? `• ${viewingClient.phone}` : ''}</p></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Total Comprado (Histórico)</p>
                                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatMoney(clientDetails.totalSpent)}</p>
                                </div>
                                <div className={`p-4 rounded-lg border ${clientDetails.currentDebt > 0.01 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30' : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30'}`}>
                                    <p className={`text-xs font-bold uppercase ${clientDetails.currentDebt > 0.01 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>Deuda Pendiente Actual</p>
                                    <p className={`text-2xl font-bold ${clientDetails.currentDebt > 0.01 ? 'text-orange-800 dark:text-orange-200' : 'text-green-800 dark:text-green-200'}`}>{formatMoney(clientDetails.currentDebt)}</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto no-scrollbar">
                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 font-bold text-sm text-gray-700 dark:text-gray-300 sticky left-0">Historial de Movimientos</div>
                                <table className="w-full text-sm text-left min-w-[650px]">
                                    <thead className="bg-gray-100 dark:bg-gray-700 uppercase text-xs text-gray-700 dark:text-gray-300">
                                        <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Resumen Compra</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-center">Estado</th><th className="px-4 py-3 text-center">Acción</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {clientDetails.transactions.length === 0 ? (<tr><td colSpan={5} className="text-center py-4 text-gray-500">Sin registros.</td></tr>) : (
                                            clientDetails.transactions.map((tx) => {
                                                const hasCredit = tx.payments.some(p => p.method === PaymentMethod.CREDIT);
                                                const debtAmount = hasCredit ? (tx.payments.find(p => p.method === PaymentMethod.CREDIT)?.amountInUSD || 0) : 0;
                                                const paidAmount = tx.debtPayments?.reduce((sum, p) => sum + p.amountInUSD, 0) || 0;
                                                const remaining = Math.max(0, debtAmount - paidAmount);
                                                const isFullyPaid = !hasCredit || remaining < 0.01;
                                                return (<tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{new Date(tx.timestamp).toLocaleDateString()}</td><td className="px-4 py-3"><div className="line-clamp-1">{tx.items.length} ítems ({tx.items.map(i => i.name).join(', ')})</div></td><td className="px-4 py-3 text-right font-medium">${tx.totalUSD.toFixed(2)}</td><td className="px-4 py-3 text-center">{hasCredit ? (isFullyPaid ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-bold">Pagado</span> : <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-bold">Debe ${remaining.toFixed(2)}</span>) : (<span className="text-gray-400 text-xs">Contado</span>)}</td><td className="px-4 py-3 text-center">{!isFullyPaid && (<button onClick={() => openDebtPayment({ ...tx, debtAmount: remaining })} className="text-green-600 hover:text-green-800 font-bold text-xs underline">Abonar</button>)}</td></tr>);
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto no-scrollbar">
                            <table className="w-full text-sm text-left min-w-[500px]">
                                <thead className="bg-gray-100 dark:bg-gray-700 uppercase text-xs text-gray-700 dark:text-gray-300">
                                    <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">C.I. / RIF</th><th className="px-4 py-3">Teléfono</th><th className="px-4 py-3 text-center">Acciones</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {editingClientId === 'NEW' && (<tr className="bg-blue-50 dark:bg-blue-900/20"><td className="px-4 py-2"><input autoFocus className="w-full p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Nombre" value={clientFormData.name} onChange={e => setClientFormData({...clientFormData, name: e.target.value})} /></td><td className="px-4 py-2"><input className="w-full p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="C.I." value={clientFormData.docId} onChange={e => setClientFormData({...clientFormData, docId: e.target.value})} /></td><td className="px-4 py-2"><input className="w-full p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Teléfono" value={clientFormData.phone} onChange={e => setClientFormData({...clientFormData, phone: e.target.value})} /></td><td className="px-4 py-2 flex justify-center gap-2"><button onClick={handleSaveClientForm} className="text-green-600"><Save size={18}/></button><button onClick={() => setEditingClientId(null)} className="text-red-600"><X size={18}/></button></td></tr>)}
                                    {clients.map(client => (<tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">{editingClientId === client.id ? (<><td className="px-4 py-2"><input className="w-full p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={clientFormData.name} onChange={e => setClientFormData({...clientFormData, name: e.target.value})} /></td><td className="px-4 py-2"><input className="w-full p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={clientFormData.docId} onChange={e => setClientFormData({...clientFormData, docId: e.target.value})} /></td><td className="px-4 py-2"><input className="w-full p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={clientFormData.phone} onChange={e => setClientFormData({...clientFormData, phone: e.target.value})} /></td><td className="px-4 py-2 flex justify-center gap-2"><button onClick={handleSaveClientForm} className="text-green-600"><Save size={18}/></button><button onClick={() => setEditingClientId(null)} className="text-red-600"><X size={18}/></button></td></>) : (<><td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{client.name}</td><td className="px-4 py-3 text-gray-500 dark:text-gray-400">{client.docId || '-'}</td><td className="px-4 py-3 text-gray-500 dark:text-gray-400">{client.phone || '-'}</td><td className="px-4 py-3 flex justify-center gap-2"><button onClick={() => setViewingClient(client)} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded" title="Ver Historial y Deudas"><List size={18}/></button><button onClick={() => handleEditClient(client)} className="text-gray-500 hover:text-blue-700 p-1.5 rounded"><Edit2 size={18}/></button><button onClick={() => onDeleteClient(client.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded"><Trash2 size={18}/></button></td></>)}</tr>))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'debts' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2"><User size={20}/> Cuentas por Cobrar (Fiado)</h3>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-gray-700 uppercase text-xs text-gray-700 dark:text-gray-300"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3 text-right">Monto Deuda</th><th className="px-4 py-3 text-center">Acciones</th></tr></thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {debts.map((tx) => (<tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-3">{tx.clientName}</td><td className="px-4 py-3 text-gray-500">{new Date(tx.timestamp).toLocaleDateString()}</td><td className="px-4 py-3 text-right font-bold text-red-600">${tx.debtAmount.toFixed(2)}</td><td className="px-4 py-3 text-center flex items-center justify-center gap-2"><button onClick={() => onReprintTransaction(tx)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded transition" title="Imprimir Recibo"><Printer size={16} /></button><button onClick={() => openDebtPayment(tx)} className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-bold transition flex items-center justify-center gap-1"><CheckCircle size={14} /> Registrar Abono</button></td></tr>))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {activeTab === 'inventory' && (
                <div className="space-y-6">
                     <div className="flex justify-between items-center"><h3 className="text-lg font-semibold dark:text-white flex items-center gap-2"><Box size={20}/> Gestión de Inventario</h3><button onClick={handleCreateInv} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 text-sm font-bold shadow-sm" disabled={editingInvId !== null}><Plus size={18} /> Nuevo Material</button></div>
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-gray-700 uppercase text-xs text-gray-700 dark:text-gray-300">
                                <tr><th className="px-4 py-3">Material</th><th className="px-4 py-3 text-center">Disponible</th><th className="px-4 py-3 text-center">Unidad</th><th className="px-4 py-3 text-center">Acciones</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {editingInvId === 'NEW' && (
                                    <tr className="bg-blue-50 dark:bg-blue-900/20">
                                        <td className="px-4 py-2"><input autoFocus className="w-full p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Nombre (ej: Papel Foto)" value={invFormData.name} onChange={e => setInvFormData({...invFormData, name: e.target.value})} /></td>
                                        <td className="px-4 py-2 text-center"><input type="number" className="w-20 p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center" placeholder="0" value={invFormData.quantity} onChange={e => setInvFormData({...invFormData, quantity: parseFloat(e.target.value)})} /></td>
                                        <td className="px-4 py-2 text-center"><input className="w-24 p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center" placeholder="ej: hojas" value={invFormData.unit} onChange={e => setInvFormData({...invFormData, unit: e.target.value})} /></td>
                                        <td className="px-4 py-2 flex justify-center gap-2"><button onClick={handleSaveInv} className="text-green-600"><Save size={18}/></button><button onClick={() => setEditingInvId(null)} className="text-red-600"><X size={18}/></button></td>
                                    </tr>
                                )}
                                {inventory.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        {editingInvId === item.id ? (
                                            <>
                                                <td className="px-4 py-2"><input className="w-full p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={invFormData.name} onChange={e => setInvFormData({...invFormData, name: e.target.value})} /></td>
                                                <td className="px-4 py-2 text-center"><input type="number" className="w-20 p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center" value={invFormData.quantity} onChange={e => setInvFormData({...invFormData, quantity: parseFloat(e.target.value)})} /></td>
                                                <td className="px-4 py-2 text-center"><input className="w-24 p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center" value={invFormData.unit} onChange={e => setInvFormData({...invFormData, unit: e.target.value})} /></td>
                                                <td className="px-4 py-2 flex justify-center gap-2"><button onClick={handleSaveInv} className="text-green-600"><Save size={18}/></button><button onClick={() => setEditingInvId(null)} className="text-red-600"><X size={18}/></button></td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{item.name}</td>
                                                <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${item.quantity < 20 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'}`}>{item.quantity}</span></td>
                                                <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{item.unit}</td>
                                                <td className="px-4 py-3 flex justify-center gap-3">
                                                    <button onClick={() => openRestockForm(item)} className="text-green-600 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-900/30 p-1.5 rounded transition" title="Comprar / Reponer Stock"><ShoppingCart size={18}/></button>
                                                    <button onClick={() => handleEditInv(item)} className="text-blue-500 hover:text-blue-700 p-1.5 rounded"><Edit2 size={18}/></button>
                                                    <button onClick={() => setConfirmAction({type:'DELETE_INV', id: item.id})} className="text-gray-400 hover:text-red-500 p-1.5 rounded"><Trash2 size={18}/></button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {activeTab === 'data' && (
                <div className="flex flex-col h-full space-y-8 p-6 overflow-auto">
                     <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-xl shadow border dark:border-gray-700">
                        <h3 className="text-lg font-bold dark:text-white flex items-center gap-2"><ShieldCheck size={20} className="text-purple-600"/> Configuración de Seguridad</h3>
                        <p className="text-sm text-gray-500 mb-4">Protege acciones sensibles (borrar ventas, editar inventario, ver estadísticas) con un PIN.</p>
                        <div className="flex items-center gap-4">
                             {settings.adminPin ? (<div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded border border-green-200 dark:border-green-800"><Lock size={16} className="text-green-600"/><span className="text-sm font-bold text-green-700 dark:text-green-300">PIN Activo</span></div>) : (<div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded border dark:border-gray-600"><Lock size={16} className="text-gray-400"/><span className="text-sm text-gray-500 dark:text-gray-300">Sin protección</span></div>)}
                             <button onClick={() => setShowPinInput(true)} className="text-blue-600 hover:underline text-sm font-bold">{settings.adminPin ? 'Cambiar / Eliminar PIN' : 'Configurar PIN'}</button>
                        </div>
                        {showPinInput && (
                            <div className="flex items-center gap-2 mt-2 animate-in fade-in">
                                <input type="text" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm w-40 tracking-widest" placeholder="Nuevo PIN" value={newPin} onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); if(val.length <= 6) setNewPin(val); }} maxLength={6} />
                                <button onClick={handleSavePin} className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-purple-700">Guardar</button>
                                <button onClick={() => { setShowPinInput(false); setNewPin(''); }} className="text-gray-500 hover:text-gray-700 px-2">Cancelar</button>
                            </div>
                        )}
                     </div>
                     <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-xl shadow border dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2"><FileText size={20} className="text-green-600"/> Reportes y Exportación</h3>
                        <div className="flex gap-4">
                             <button onClick={handleExportExcel} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition"><FileSpreadsheet size={20}/> Exportar Excel</button>
                             <button onClick={handleExportPDF} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition"><FileText size={20}/> Exportar PDF</button>
                        </div>
                     </div>
                     <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-xl shadow border dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2"><Database size={20} className="text-blue-600"/> Copia de Seguridad</h3>
                        <div className="flex gap-4">
                             <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition"><Download size={20}/> Respaldo (JSON)</button>
                             <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold transition"><Upload size={20}/> Restaurar Datos</button>
                             <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
                        </div>
                     </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
