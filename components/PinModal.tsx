import React, { useState, useEffect, useRef } from 'react';
import { Lock, Delete, X } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin?: string;
  title?: string;
}

export const PinModal: React.FC<PinModalProps> = ({ isOpen, onClose, onSuccess, correctPin, title = "Ingrese PIN de Administrador" }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleNumber = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);
      
      // Auto submit if length matches correct pin length (assuming 4 or 6)
      if (correctPin && newPin === correctPin) {
        setTimeout(() => onSuccess(), 100);
      } else if (correctPin && newPin.length === correctPin.length) {
         setError(true);
         setTimeout(() => setPin(''), 500);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      handleNumber(e.key);
    } else if (e.key === 'Backspace') {
      handleDelete();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border dark:border-gray-700 animate-in zoom-in-95 duration-200">
        
        <div className="p-6 pb-2 text-center relative">
           <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white"><X size={20}/></button>
           <div className="mx-auto bg-blue-100 dark:bg-blue-900/30 w-12 h-12 rounded-full flex items-center justify-center mb-3">
              <Lock className="text-blue-600 dark:text-blue-400" size={24} />
           </div>
           <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
           <p className="text-xs text-gray-500 mt-1">Acceso Restringido</p>
        </div>

        <div className="flex justify-center my-4 gap-3">
          {[...Array(correctPin?.length || 4)].map((_, i) => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length 
                  ? error ? 'bg-red-500' : 'bg-blue-600' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
        
        {/* Hidden input for keyboard support */}
        <input 
            ref={inputRef}
            className="opacity-0 absolute" 
            autoFocus 
            onKeyDown={handleKeyDown} 
            onBlur={() => inputRef.current?.focus()} 
        />

        <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-gray-700">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumber(num.toString())}
              className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 py-5 text-xl font-bold text-gray-700 dark:text-gray-200 active:bg-gray-200 transition-colors"
            >
              {num}
            </button>
          ))}
          <div className="bg-white dark:bg-gray-800"></div>
          <button
            onClick={() => handleNumber('0')}
            className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 py-5 text-xl font-bold text-gray-700 dark:text-gray-200 active:bg-gray-200 transition-colors"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 py-5 flex items-center justify-center text-red-500 active:bg-red-100 transition-colors"
          >
            <Delete size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
