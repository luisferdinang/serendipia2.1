import React, { useState, useEffect, useMemo } from 'react';
import { PaymentMethod, ExchangeRates, RateType, Client, PrintMode } from '../types';
import { Calculator, Wallet, Banknote, CreditCard, ArrowRight, User, FileText, Plus, Check, Printer, Calendar, Globe, DollarSign } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalUSD: number;
  rates: ExchangeRates;
  onConfirm: (
      payments: { method: PaymentMethod; amount: number; amountInUSD: number; reference?: string }[], 
      clientData: { id?: string, name: string } | undefined, 
      shouldPrint: boolean, 
      customDate?: string,
      printMode?: PrintMode
  ) => void;
  clients: Client[];
  onSaveClient: (client: Client) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, totalUSD, rates, onConfirm, clients, onSaveClient }) => {
  // Amounts
  const [payCashUSD, setPayCashUSD] = useState<string>('');
  const [payPagoMovil, setPayPagoMovil] = useState<string>('');
  const [payCashVES, setPayCashVES] = useState<string>('');
  const [payUSDT, setPayUSDT] = useState<string>('');
  const [payCredit, setPayCredit] = useState<string>(''); 

  // References & Date & Mode
  const [refPagoMovil, setRefPagoMovil] = useState<string>('');
  const [refUSDT, setRefUSDT] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>('');
  const [printMode, setPrintMode] = useState<PrintMode>('MIXED');

  // Client & Receipt
  const [wantsCustomReceipt, setWantsCustomReceipt] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [tempClientName, setTempClientName] = useState<string>('');
  
  // Quick Create Client
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', docId: '', phone: '' });

  useEffect(() => {
    if (isOpen) {
      setPayCashUSD('');
      setPayPagoMovil('');
      setPayCashVES('');
      setPayUSDT('');
      setPayCredit('');
      setRefPagoMovil('');
      setRefUSDT('');
      setWantsCustomReceipt(false);
      setSelectedClientId('');
      setTempClientName('');
      setIsCreatingClient(false);
      setPrintMode('MIXED');
      // Set default date to today's date in YYYY-MM-DD
      const today = new Date();
      // Adjust for local timezone to ensure we get the correct "today" string
      const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      setTransactionDate(localDate);
    }
  }, [isOpen]);

  const activeRate = rates.selected === RateType.BCV ? rates.bcv : rates.parallel;
  const totalVES = totalUSD * activeRate;

  // Calculations
  const valCashUSD = parseFloat(payCashUSD) || 0;
  const valUSDT = parseFloat(payUSDT) || 0;
  const valPagoMovil = parseFloat(payPagoMovil) || 0;
  const valCashVES = parseFloat(payCashVES) || 0;
  const valCredit = parseFloat(payCredit) || 0;

  const totalPaidInUSD = valCashUSD + valUSDT + (valPagoMovil / activeRate) + (valCashVES / activeRate) + valCredit;
  const remainingUSD = totalUSD - totalPaidInUSD;
  const changeUSD = Math.abs(remainingUSD);
  const changeVES = Math.abs(remainingUSD * activeRate);
  
  const isComplete = remainingUSD <= 0.01; 

  const handleQuickCreateClient = () => {
    if(!newClientData.name) return;
    const newClient: Client = {
      id: Date.now().toString(),
      name: newClientData.name,
      docId: newClientData.docId,
      phone: newClientData.phone
    };
    onSaveClient(newClient);
    setSelectedClientId(newClient.id);
    setIsCreatingClient(false);
    setNewClientData({ name: '', docId: '', phone: '' });
  };

  const handleConfirm = (shouldPrint: boolean) => {
    if (!isComplete && Math.abs(remainingUSD) > 0.01) return;
    
    // Validation for Credit or Custom Receipt
    const needsClient = valCredit > 0 || wantsCustomReceipt;
    let finalClientData: { id?: string, name: string } | undefined;

    if (needsClient) {
        if (selectedClientId) {
            const client = clients.find(c => c.id === selectedClientId);
            if (client) finalClientData = { id: client.id, name: client.name };
        } else if (tempClientName.trim()) {
            finalClientData = { name: tempClientName };
        } else {
            alert(valCredit > 0 ? "Para fiar, debes seleccionar un cliente o escribir un nombre." : "Para recibo personalizado, selecciona un cliente.");
            return;
        }
    }

    const payments = [];
    if (valCashUSD > 0) payments.push({ method: PaymentMethod.USD_CASH, amount: valCashUSD, amountInUSD: valCashUSD });
    if (valUSDT > 0) payments.push({ method: PaymentMethod.USDT, amount: valUSDT, amountInUSD: valUSDT, reference: refUSDT });
    if (valPagoMovil > 0) payments.push({ method: PaymentMethod.VES_PAGO_MOVIL, amount: valPagoMovil, amountInUSD: valPagoMovil / activeRate, reference: refPagoMovil });
    if (valCashVES > 0) payments.push({ method: PaymentMethod.VES_CASH, amount: valCashVES, amountInUSD: valCashVES / activeRate });
    if (valCredit > 0) payments.push({ method: PaymentMethod.CREDIT, amount: valCredit, amountInUSD: valCredit });

    // Check if date is today to pass undefined (let App handle timestamp) or custom date string
    const today = new Date();
    const localToday = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const finalDate = transactionDate === localToday ? undefined : transactionDate;

    onConfirm(payments, finalClientData, shouldPrint, finalDate, printMode);
  };

  // Helper Input
  const renderPaymentInput = (
    label: string, 
    value: string, 
    setValue: (val: string) => void, 
    currency: 'USD' | 'VES',
    icon: React.ReactNode,
    referenceValue?: string,
    setReferenceValue?: (val: string) => void
  ) => {
    const currentVal = parseFloat(value) || 0;
    const currentValInUSD = currency === 'USD' ? currentVal : currentVal / activeRate;
    const paidElsewhereUSD = totalPaidInUSD - currentValInUSD;
    const remainderForThisFieldUSD = Math.max(0, totalUSD - paidElsewhereUSD);
    const fillAmount = currency === 'USD' ? remainderForThisFieldUSD : remainderForThisFieldUSD * activeRate;
    const showButton = fillAmount > 0.01 && Math.abs(currentVal - fillAmount) > 0.01;
    const isFullPayment = paidElsewhereUSD < 0.01;

    return (
      <div className="col-span-2 sm:col-span-1 relative group bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
          {icon} {label}
        </label>
        <div className="relative">
          <input 
            type="number" 
            className={`w-full p-2 pl-3 pr-16 border rounded outline-none transition-all font-mono font-bold text-gray-800 dark:text-white bg-white dark:bg-gray-700 ${value ? 'border-primary ring-1 ring-primary/20 bg-blue-50/20 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 focus:border-primary'}`}
            placeholder="0.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            step="0.01"
          />
          {showButton && (
            <button 
              onClick={() => setValue(fillAmount.toFixed(2))}
              className="absolute right-1 top-1 bottom-1 px-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 text-[10px] font-bold rounded flex flex-col justify-center items-end min-w-[60px] transition-colors z-10"
              tabIndex={-1} 
            >
              <span>{isFullPayment ? 'TODO' : 'RESTO'}</span>
              <span className="opacity-75">{currency === 'USD' ? '$' : 'Bs.'}{fillAmount.toFixed(2)}</span>
            </button>
          )}
        </div>
        {referenceValue !== undefined && setReferenceValue && parseFloat(value) > 0 && (
             <div className="mt-2 animate-in slide-in-from-top-1 fade-in">
                 <input 
                    type="text"
                    placeholder="Ref. (últimos 4)"
                    className="w-full text-xs p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    value={referenceValue}
                    onChange={e => setReferenceValue(e.target.value)}
                 />
             </div>
        )}
      </div>
    );
  };

  const filteredClients = useMemo(() => {
     if(!tempClientName) return clients.slice(0, 5); // Show recent 5 if empty
     return clients.filter(c => c.name.toLowerCase().includes(tempClientName.toLowerCase())).slice(0, 5);
  }, [clients, tempClientName]);

  const isDisabled = remainingUSD > 0.01 || (valCredit > 0 && !tempClientName && !selectedClientId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 no-print">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-primary text-white p-4 shrink-0">
          <div className="flex justify-between items-start">
             <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><Calculator size={20}/> Procesar Pago</h2>
                <div className="flex items-center gap-4 mt-1">
                   <p className="text-xs opacity-80">Tasa: Bs. {activeRate.toFixed(2)}</p>
                   <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded">
                       <Calendar size={12} />
                       <input 
                          type="date" 
                          className="bg-transparent text-xs outline-none border-none text-white cursor-pointer"
                          value={transactionDate}
                          onChange={e => setTransactionDate(e.target.value)}
                       />
                   </div>
                </div>
             </div>
             <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Big Totals */}
          <div className="flex justify-between items-center text-lg font-bold border-b border-gray-100 dark:border-gray-700 pb-4 bg-gray-50 dark:bg-gray-900 -mx-6 px-6 pt-2">
            <div>
              <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Total USD</p>
              <p className="text-3xl text-gray-800 dark:text-white">${totalUSD.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Total Bs</p>
              <p className="text-2xl text-primary dark:text-blue-400">Bs. {totalVES.toFixed(2)}</p>
            </div>
          </div>

          {/* Payment Inputs */}
          <div className="grid grid-cols-2 gap-4">
            {renderPaymentInput("Efectivo USD", payCashUSD, setPayCashUSD, 'USD', <Banknote size={14} className="text-green-600 dark:text-green-400"/>)}
            {renderPaymentInput("Binance USDT", payUSDT, setPayUSDT, 'USD', <Wallet size={14} className="text-yellow-500"/>, refUSDT, setRefUSDT)}
            {renderPaymentInput("Pago Móvil (Bs)", payPagoMovil, setPayPagoMovil, 'VES', <ArrowRight size={14} className="text-purple-600 dark:text-purple-400"/>, refPagoMovil, setRefPagoMovil)}
            {renderPaymentInput("Efectivo (Bs)", payCashVES, setPayCashVES, 'VES', <Banknote size={14} className="text-blue-600 dark:text-blue-400"/>)}
            {renderPaymentInput("Fiar / Crédito ($)", payCredit, setPayCredit, 'USD', <User size={14} className="text-orange-500"/>)}
          </div>

          {/* Client & Receipt Section */}
          <div className="border-t dark:border-gray-700 pt-4">
               <div className="flex justify-between items-center mb-3">
                   <div className="flex items-center gap-2">
                       <User size={18} className="text-gray-500"/>
                       <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">Datos del Cliente</span>
                   </div>
                   <label className="flex items-center gap-2 cursor-pointer">
                       <input 
                         type="checkbox" 
                         className="w-4 h-4 rounded text-primary focus:ring-primary"
                         checked={wantsCustomReceipt}
                         onChange={e => setWantsCustomReceipt(e.target.checked)}
                       />
                       <span className="text-xs font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1">
                           <FileText size={14}/> Recibo Personalizado
                       </span>
                   </label>
               </div>

               {/* Standard Client Selector */}
               {(wantsCustomReceipt || valCredit > 0) && !isCreatingClient && (
                    <div className="animate-in slide-in-from-top-2 fade-in">
                        <div className="relative">
                            <input 
                                type="text"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                                placeholder={valCredit > 0 ? "Buscar cliente para fiar..." : "Buscar cliente para recibo..."}
                                value={tempClientName}
                                onChange={e => {
                                    setTempClientName(e.target.value);
                                    setSelectedClientId(''); // Clear ID if typing manual name
                                }}
                            />
                            {/* Suggestions Dropdown */}
                            {tempClientName && !selectedClientId && filteredClients.length > 0 && (
                                <ul className="absolute z-20 w-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-b shadow-lg max-h-40 overflow-auto">
                                    {filteredClients.map(client => (
                                        <li 
                                            key={client.id}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm flex justify-between"
                                            onClick={() => {
                                                setSelectedClientId(client.id);
                                                setTempClientName(client.name);
                                            }}
                                        >
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{client.name}</span>
                                            {client.docId && <span className="text-gray-500 text-xs">{client.docId}</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="mt-2 text-right">
                             <button 
                                onClick={() => setIsCreatingClient(true)}
                                className="text-xs text-primary dark:text-blue-400 font-bold hover:underline flex items-center gap-1 justify-end ml-auto"
                             >
                                 <Plus size={12}/> Crear Nuevo Cliente
                             </button>
                        </div>
                    </div>
               )}

               {/* Create Client Form */}
               {(wantsCustomReceipt || valCredit > 0) && isCreatingClient && (
                   <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg animate-in fade-in">
                       <div className="grid grid-cols-2 gap-2 mb-2">
                           <input 
                                className="col-span-2 p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="Nombre Completo *"
                                value={newClientData.name}
                                onChange={e => setNewClientData({...newClientData, name: e.target.value})}
                                autoFocus
                           />
                           <input 
                                className="p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="C.I. / RIF"
                                value={newClientData.docId}
                                onChange={e => setNewClientData({...newClientData, docId: e.target.value})}
                           />
                           <input 
                                className="p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="Teléfono"
                                value={newClientData.phone}
                                onChange={e => setNewClientData({...newClientData, phone: e.target.value})}
                           />
                       </div>
                       <div className="flex justify-end gap-2">
                           <button onClick={() => setIsCreatingClient(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancelar</button>
                           <button 
                                onClick={handleQuickCreateClient}
                                disabled={!newClientData.name}
                                className="bg-primary text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-50"
                           >
                               <Check size={12}/> Guardar
                           </button>
                       </div>
                   </div>
               )}
          </div>

          {/* Print Mode Selector */}
          <div className="flex justify-center gap-4 py-2 border-t dark:border-gray-700 mt-2">
              <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="printMode" className="text-primary" checked={printMode === 'MIXED'} onChange={() => setPrintMode('MIXED')} />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"><Globe size={12}/> Mixto</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="printMode" className="text-primary" checked={printMode === 'USD'} onChange={() => setPrintMode('USD')} />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"><DollarSign size={12}/> Solo $</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="printMode" className="text-primary" checked={printMode === 'VES'} onChange={() => setPrintMode('VES')} />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"><Banknote size={12}/> Solo Bs</span>
              </label>
          </div>

          {/* Remaining */}
          <div className={`p-4 rounded-lg transition-colors border ${
            remainingUSD > 0.01 
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200' 
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
          }`}>
            {remainingUSD > 0.01 ? (
               <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                    <span className="font-bold text-sm">Falta por cubrir:</span>
                 </div>
                 <div className="text-right">
                   <div className="font-bold text-lg">${remainingUSD.toFixed(2)}</div>
                   <div className="text-xs opacity-75">Bs. {(remainingUSD * activeRate).toFixed(2)}</div>
                 </div>
               </div>
            ) : (
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="font-bold text-sm">{Math.abs(remainingUSD) < 0.01 ? 'Pago Exacto' : 'Vuelto / Cambio:'}</span>
                 </div>
                {Math.abs(remainingUSD) >= 0.01 && (
                  <div className="text-right">
                    <div className="font-bold text-lg">${changeUSD.toFixed(2)}</div>
                    <div className="text-xs opacity-75">Bs. {changeVES.toFixed(2)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end space-x-2 shrink-0">
          <button onClick={onClose} className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm transition">Cancelar</button>
          
          <button 
            onClick={() => handleConfirm(false)}
            disabled={isDisabled}
            className={`px-4 py-2 rounded text-white font-bold shadow flex items-center gap-2 transition-all transform active:scale-95 ${
              isDisabled
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed shadow-none' 
              : 'bg-primary hover:bg-blue-600'
            }`}
          >
             <Check size={18} />
             <span>Confirmar</span>
          </button>

          <button 
            onClick={() => handleConfirm(true)}
            disabled={isDisabled}
            className={`px-4 py-2 rounded text-white font-bold shadow flex items-center gap-2 transition-all transform active:scale-95 ${
              isDisabled
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed shadow-none' 
              : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600'
            }`}
          >
             <Printer size={18} />
             <span>Confirmar e Imprimir</span>
          </button>
        </div>
      </div>
    </div>
  );
};