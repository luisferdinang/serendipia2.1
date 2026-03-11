import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ShoppingCart, User, FileText, ArrowRight, Package } from 'lucide-react';
import { Product, Client, Transaction } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  clients: Client[];
  transactions: Transaction[];
  onSelectProduct: (product: Product) => void;
  onSelectClient: (client: Client) => void;
  onSelectTransaction: (tx: Transaction) => void;
}

type SearchResult = 
  | { type: 'PRODUCT'; data: Product }
  | { type: 'CLIENT'; data: Client }
  | { type: 'TX'; data: Transaction };

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen, onClose, products, clients, transactions, onSelectProduct, onSelectClient, onSelectTransaction
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQ = query.toLowerCase();
    
    const productResults: SearchResult[] = products
      .filter(p => p.name.toLowerCase().includes(lowerQ) || p.category.toLowerCase().includes(lowerQ))
      .slice(0, 5)
      .map(p => ({ type: 'PRODUCT', data: p }));

    const clientResults: SearchResult[] = clients
      .filter(c => c.name.toLowerCase().includes(lowerQ) || (c.docId && c.docId.includes(lowerQ)))
      .slice(0, 3)
      .map(c => ({ type: 'CLIENT', data: c }));

    const txResults: SearchResult[] = transactions
      .filter(t => t.id.includes(lowerQ) || (t.clientName && t.clientName.toLowerCase().includes(lowerQ)))
      .slice(0, 3)
      .map(t => ({ type: 'TX', data: t }));

    return [...productResults, ...clientResults, ...txResults];
  }, [query, products, clients, transactions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'PRODUCT') onSelectProduct(result.data);
    if (result.type === 'CLIENT') onSelectClient(result.data);
    if (result.type === 'TX') onSelectTransaction(result.data);
    onClose();
  };

  // Auto-scroll to selected item
  useEffect(() => {
    if (listRef.current && listRef.current.children[selectedIndex]) {
      listRef.current.children[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] flex items-start justify-center pt-[15vh] p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border dark:border-gray-700 ring-1 ring-gray-900/5" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center p-4 border-b dark:border-gray-700 gap-3">
          <Search className="text-gray-400" size={20} />
          <input
            ref={inputRef}
            className="flex-1 text-lg bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
            placeholder="Buscar productos, clientes, recibos..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <div className="hidden sm:flex gap-1">
             <kbd className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">Esc</kbd>
          </div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-2" ref={listRef}>
          {results.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              {query ? 'No se encontraron resultados.' : 'Escribe para buscar...'}
            </div>
          ) : (
            results.map((result, idx) => (
              <button
                key={`${result.type}-${idx}`}
                onClick={() => handleSelect(result)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                  idx === selectedIndex 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className={`p-2 rounded-full shrink-0 ${
                  result.type === 'PRODUCT' ? 'bg-orange-100 text-orange-600' :
                  result.type === 'CLIENT' ? 'bg-purple-100 text-purple-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  {result.type === 'PRODUCT' && <Package size={18} />}
                  {result.type === 'CLIENT' && <User size={18} />}
                  {result.type === 'TX' && <FileText size={18} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  {result.type === 'PRODUCT' && (
                    <>
                      <div className="font-bold truncate">{result.data.name}</div>
                      <div className="text-xs opacity-75 flex justify-between">
                        <span>{result.data.category}</span>
                        <span className="font-bold">${result.data.priceUSD.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {result.type === 'CLIENT' && (
                    <>
                      <div className="font-bold truncate">{result.data.name}</div>
                      <div className="text-xs opacity-75">{result.data.docId || 'Sin documento'}</div>
                    </>
                  )}
                  {result.type === 'TX' && (
                    <>
                      <div className="font-bold truncate">Recibo #{result.data.id.slice(-6)}</div>
                      <div className="text-xs opacity-75 flex justify-between">
                        <span>{new Date(result.data.timestamp).toLocaleDateString()}</span>
                        <span className="font-bold">${result.data.totalUSD.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
                
                {idx === selectedIndex && (
                  <ArrowRight size={16} className="opacity-50" />
                )}
              </button>
            ))
          )}
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/30 p-2 text-xs text-center text-gray-500 border-t dark:border-gray-700">
           <span className="font-bold">Enter</span> para seleccionar
        </div>
      </div>
    </div>
  );
};