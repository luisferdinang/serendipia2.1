import React from 'react';
import { Transaction, RateType, PrintMode } from '../types';

interface DebtReceiptData {
  clientName: string;
  transactionId: string;
  timestamp: number;
  amountPaid: number;
  paymentMethod: string;
  previousDebt: number;
  newDebt: number;
}

interface ReceiptProps {
  transaction: Transaction | null;
  debtPayment?: DebtReceiptData | null;
  mode?: PrintMode; // 'USD' | 'VES' | 'MIXED'
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, debtPayment, mode = 'MIXED' }) => {
  const showUSD = mode === 'USD' || mode === 'MIXED';
  const showVES = mode === 'VES' || mode === 'MIXED';

  // 1. Debt Payment Receipt Logic
  if (debtPayment) {
    return (
      <div className="print-only font-mono text-xs p-2 max-w-[80mm] mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold uppercase">Serendipia</h1>
          <p className="text-sm">COMPROBANTE DE ABONO</p>
          <div className="mt-2 border-t border-black pt-1">
              <p>{new Date(debtPayment.timestamp).toLocaleString()}</p>
          </div>
        </div>

        <div className="mb-4 border-b border-dashed border-black pb-2">
            <p><strong>Cliente:</strong> {debtPayment.clientName}</p>
            <p><strong>Ref. Venta:</strong> #{debtPayment.transactionId.slice(-6)}</p>
        </div>

        <div className="flex justify-between font-bold text-sm mb-2">
          <span>MONTO ABONADO:</span>
          <span>${debtPayment.amountPaid.toFixed(2)}</span>
        </div>
        <div className="text-xs mb-4 text-right">
           ({debtPayment.paymentMethod})
        </div>

        <div className="border-t border-black pt-2 mb-4">
          <div className="flex justify-between text-xs">
            <span>Deuda Anterior:</span>
            <span>${debtPayment.previousDebt.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm mt-1">
            <span>SALDO RESTANTE:</span>
            <span>${debtPayment.newDebt.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center mt-8">
          <p>{debtPayment.newDebt <= 0.01 ? '¡DEUDA PAGADA!' : 'Gracias por su abono.'}</p>
        </div>
      </div>
    );
  }

  // 2. Standard Sales Receipt Logic (Existing)
  if (!transaction) return null;

  const rate = transaction.rateUsed;

  return (
    <div className="print-only font-mono text-xs p-2 max-w-[80mm] mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold uppercase">Serendipia</h1>
        <p className="text-sm">Maturín, Monagas</p>
        <div className="mt-2 border-t border-black pt-1">
            <p>{new Date(transaction.timestamp).toLocaleString()}</p>
            <p>Orden #{transaction.id.slice(-6)}</p>
        </div>
      </div>

      {/* Client Info Section */}
      <div className="mb-4 border-b border-dashed border-black pb-2">
          <p><strong>Cliente:</strong> {transaction.clientName || 'Consumidor Final'}</p>
          {transaction.clientDoc && <p><strong>CI/RIF:</strong> {transaction.clientDoc}</p>}
      </div>

      <div className="border-b border-black mb-2 pb-2">
        <div className="flex justify-between text-[10px] font-bold border-b border-gray-400 mb-1 pb-1">
            <span>DESCRIPCIÓN</span>
            <span>TOTAL</span>
        </div>
        {transaction.items.map((item, idx) => {
            const unitPrice = mode === 'VES' ? (item.priceUSD * rate) : item.priceUSD;
            const subtotal = unitPrice * item.quantity;
            const symbol = mode === 'VES' ? 'Bs.' : '$';

            return (
              <div key={idx} className="mb-2">
                {/* Product Name on its own line for clarity */}
                <div className="font-bold text-xs leading-tight mb-0.5">{item.name}</div>
                
                {/* Detail Line: Qty x Price = Subtotal */}
                <div className="flex justify-between text-[10px] pl-2 text-gray-800">
                    <span>
                        {item.quantity} x {symbol}{unitPrice.toFixed(2)}
                    </span>
                    <span className="font-bold">
                        {symbol}{subtotal.toFixed(2)}
                    </span>
                </div>
              </div>
            );
        })}
      </div>

      {showUSD && (
        <div className="flex justify-between font-bold text-sm mb-1">
            <span>TOTAL USD:</span>
            <span>${transaction.totalUSD.toFixed(2)}</span>
        </div>
      )}
      
      {showVES && (
        <>
            {mode === 'MIXED' && (
                <div className="flex justify-between text-xs mb-1">
                    <span>Tasa:</span>
                    <span>Bs. {rate.toFixed(2)}</span>
                </div>
            )}
            <div className="flex justify-between font-bold text-sm mb-4">
                <span>TOTAL BS:</span>
                <span>Bs. {(transaction.totalUSD * rate).toFixed(2)}</span>
            </div>
        </>
      )}

      {mode === 'VES' && (
           <div className="text-[10px] text-right mb-4">Ref. Tasa: {rate.toFixed(2)}</div>
      )}

      <div className="mb-4 border-t border-black pt-2">
        <p className="font-bold underline mb-1">Métodos de Pago:</p>
        {transaction.payments.map((p, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{p.method}</span>
            <span>{p.method.includes('USD') || p.method.includes('USDT') ? `$${p.amountInUSD.toFixed(2)}` : `Bs.${p.amount.toFixed(2)}`}</span>
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <p>¡Gracias por preferirnos!</p>
        <p className="text-[10px] mt-1">Serendipia - Creando momentos</p>
      </div>
    </div>
  );
};