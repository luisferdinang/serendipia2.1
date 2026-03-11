import React, { useState, useEffect } from 'react';
import { Product, InventoryItem, ProductMaterial } from '../types';
import { Trash2, Edit2, Plus, X, Save, Minus } from 'lucide-react';

interface ProductManagerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  inventoryItems: InventoryItem[];
  onSave: (product: Product) => void;
  onDelete: (id: string) => void;
  initialEditId?: string;
}

const EMPTY_PRODUCT: Product = {
  id: '',
  name: '',
  priceUSD: 0,
  category: 'General',
  materials: []
};

export const ProductManager: React.FC<ProductManagerProps> = ({ isOpen, onClose, products, inventoryItems, onSave, onDelete, initialEditId }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Product>(EMPTY_PRODUCT);

  useEffect(() => {
    if (isOpen && initialEditId && editingId === null) {
      const p = products.find(pr => pr.id === initialEditId);
      if (p) handleEdit(p);
    }
  }, [isOpen, initialEditId, editingId, products]);

  if (!isOpen) return null;

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    let materials: ProductMaterial[] = Array.isArray(product.materials) ? product.materials : [];
    if (materials.length === 0 && product.inventoryId && product.consumption) {
        materials = [{ inventoryId: product.inventoryId, consumption: product.consumption }];
    }
    setFormData({ 
      ...product, 
      priceUSD: Number.isFinite(product.priceUSD) ? product.priceUSD : 0,
      category: product.category || 'General',
      materials 
    });
  };

  const handleCreate = () => {
    setEditingId('NEW');
    setFormData({ ...EMPTY_PRODUCT, id: Date.now().toString(), materials: [] });
  };

  const handleSave = () => {
    if (!formData.name) return;
    
    // Clean up empty materials
    const validMaterials = formData.materials?.filter(m => m.inventoryId && m.consumption > 0) || [];
    
    // For backward compatibility (optional, but good for stability), set legacy fields to the first material
    const legacyInvId = validMaterials.length > 0 ? validMaterials[0].inventoryId : undefined;
    const legacyCons = validMaterials.length > 0 ? validMaterials[0].consumption : 0;

    onSave({ 
        ...formData, 
        materials: validMaterials,
        inventoryId: legacyInvId,
        consumption: legacyCons
    });
    
    setEditingId(null);
    setFormData(EMPTY_PRODUCT);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(EMPTY_PRODUCT);
  };

  const addMaterialRow = () => {
      setFormData(prev => ({
          ...prev,
          materials: [...(prev.materials || []), { inventoryId: '', consumption: 0 }]
      }));
  };

  const removeMaterialRow = (index: number) => {
      setFormData(prev => ({
          ...prev,
          materials: (prev.materials || []).filter((_, i) => i !== index)
      }));
  };

  const updateMaterialRow = (index: number, field: keyof ProductMaterial, value: any) => {
      setFormData(prev => {
          const newMaterials = [...(prev.materials || [])];
          newMaterials[index] = { ...newMaterials[index], [field]: value };
          return { ...prev, materials: newMaterials };
      });
  };

  // Helper to get inventory name
  const getInvName = (id?: string) => {
    if (!id) return '-';
    const item = inventoryItems.find(i => i.id === id);
    return item ? item.name : 'Desconocido';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 no-print">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Administrar Productos</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4">
            <button 
              onClick={handleCreate}
              className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded hover:bg-blue-600 transition"
              disabled={editingId !== null}
            >
              <Plus size={18} />
              <span>Nuevo Producto</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm uppercase">
                  <th className="p-3 border-b dark:border-gray-600 w-[20%]">Nombre</th>
                  <th className="p-3 border-b dark:border-gray-600 w-[15%]">Categoría</th>
                  <th className="p-3 border-b dark:border-gray-600 text-right w-[10%]">Precio ($)</th>
                  <th className="p-3 border-b dark:border-gray-600 w-[45%]">Materiales Usados</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center w-[10%]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {editingId === 'NEW' && (
                  <tr className="bg-blue-50 dark:bg-blue-900/20 align-top">
                    <td className="p-2"><input autoFocus className="w-full p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Nombre" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></td>
                    <td className="p-2"><input className="w-full p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Categoría" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} /></td>
                    <td className="p-2"><input type="number" step="0.01" className="w-full p-2 border dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={Number.isFinite(formData.priceUSD) ? formData.priceUSD : 0} onChange={e => setFormData({...formData, priceUSD: Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0})} /></td>
                    <td className="p-2">
                        <div className="space-y-2">
                            {(Array.isArray(formData.materials) ? formData.materials : []).map((mat, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <select 
                                        className="flex-grow p-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                                        value={mat.inventoryId}
                                        onChange={e => updateMaterialRow(idx, 'inventoryId', e.target.value)}
                                    >
                                        <option value="">Seleccionar Material...</option>
                                        {inventoryItems.map(inv => (
                                            <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                                        ))}
                                    </select>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        className="w-16 p-1 border dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs" 
                                        placeholder="Cant"
                                        value={mat.consumption} 
                                        onChange={e => updateMaterialRow(idx, 'consumption', parseFloat(e.target.value))} 
                                    />
                                    <button onClick={() => removeMaterialRow(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 size={14}/></button>
                                </div>
                            ))}
                            <button onClick={addMaterialRow} className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"><Plus size={12}/> Agregar Material</button>
                        </div>
                    </td>
                    <td className="p-2 flex justify-center space-x-2 pt-3">
                      <button onClick={handleSave} className="text-green-600 bg-green-100 p-2 rounded hover:bg-green-200"><Save size={18} /></button>
                      <button onClick={handleCancel} className="text-red-600 bg-red-100 p-2 rounded hover:bg-red-200"><X size={18} /></button>
                    </td>
                  </tr>
                )}
                
                {products.map(product => (
                  <tr key={product.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 align-top">
                    {editingId === product.id ? (
                      <>
                        <td className="p-2"><input className="w-full p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></td>
                        <td className="p-2"><input className="w-full p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} /></td>
                        <td className="p-2"><input type="number" step="0.01" className="w-full p-2 border dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={Number.isFinite(formData.priceUSD) ? formData.priceUSD : 0} onChange={e => setFormData({...formData, priceUSD: Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0})} /></td>
                        <td className="p-2">
                            <div className="space-y-2">
                                {(Array.isArray(formData.materials) ? formData.materials : []).map((mat, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <select 
                                            className="flex-grow p-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                                            value={mat.inventoryId}
                                            onChange={e => updateMaterialRow(idx, 'inventoryId', e.target.value)}
                                        >
                                            <option value="">Seleccionar Material...</option>
                                            {inventoryItems.map(inv => (
                                                <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                                            ))}
                                        </select>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            className="w-16 p-1 border dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs" 
                                            value={mat.consumption} 
                                            onChange={e => updateMaterialRow(idx, 'consumption', parseFloat(e.target.value))} 
                                        />
                                        <button onClick={() => removeMaterialRow(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                                <button onClick={addMaterialRow} className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"><Plus size={12}/> Agregar Material</button>
                            </div>
                        </td>
                        <td className="p-2 flex justify-center space-x-2 pt-3">
                          <button onClick={handleSave} className="text-green-600 bg-green-100 p-2 rounded hover:bg-green-200"><Save size={18} /></button>
                          <button onClick={handleCancel} className="text-red-600 bg-red-100 p-2 rounded hover:bg-red-200"><X size={18} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 font-medium text-gray-800 dark:text-gray-200">{product.name}</td>
                        <td className="p-3 text-gray-500 dark:text-gray-400">{product.category}</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-bold">${Number.isFinite(product.priceUSD) ? product.priceUSD.toFixed(2) : '0.00'}</td>
                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                            {Array.isArray(product.materials) && product.materials.length > 0 ? (
                                <ul className="list-disc pl-4 space-y-1">
                                    {product.materials.map((m, i) => (
                                        <li key={i} className="text-xs">
                                            {m.consumption} x {getInvName(m.inventoryId)}
                                        </li>
                                    ))}
                                </ul>
                            ) : product.inventoryId ? (
                                <span className="text-xs">{product.consumption} x {getInvName(product.inventoryId)}</span>
                            ) : (
                                <span className="text-gray-400 text-xs italic">Sin material</span>
                            )}
                        </td>
                        <td className="p-3 flex justify-center space-x-2">
                          <button onClick={() => handleEdit(product)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800"><Edit2 size={18} /></button>
                          <button onClick={() => onDelete(product.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
