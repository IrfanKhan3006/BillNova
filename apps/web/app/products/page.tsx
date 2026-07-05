'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import { api } from '../lib/api';
import {
  Search,
  Plus,
  Package,
  FolderPlus,
  Edit2,
  Trash2,
  Tag,
  Hash,
  AlertTriangle,
  X,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Product {
  id: string;
  name: string;
  categoryId?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  salesPrice: number;
  purchasePrice: number;
  taxRate: number;
  unit: string;
  stock: number;
  category?: Category;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productModalMode, setProductModalMode] = useState<'create' | 'edit'>('create');
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');

  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    categoryId: '',
    sku: '',
    barcode: '',
    description: '',
    salesPrice: 0,
    purchasePrice: 0,
    taxRate: 0,
    unit: 'PCS',
    stock: 0,
  });

  const loadData = async (searchVal = '', catId = '') => {
    try {
      setLoading(true);
      const [prodData, catData] = await Promise.all([
        api.get('/products', { search: searchVal, categoryId: catId }),
        api.get('/products/categories'),
      ]);
      setProducts(prodData);
      setCategories(catData);
    } catch (err: any) {
      setError(err.message || 'Failed to load products/inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadData(val, selectedCategoryFilter);
  };

  const handleCategoryFilter = (catId: string) => {
    setSelectedCategoryFilter(catId);
    loadData(search, catId);
  };

  // Categories CRUD
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/products/categories', {
        name: categoryName,
        description: categoryDesc,
      });
      setCategories((prev) => [...prev, res]);
      setCategoryName('');
      setCategoryDesc('');
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create category.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Deleting this category will not delete its associated products. Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/products/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (selectedCategoryFilter === id) {
        setSelectedCategoryFilter('');
        loadData(search, '');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete category.');
    }
  };

  // Products CRUD
  const openProductCreateModal = () => {
    setProductModalMode('create');
    setProductForm({
      id: '',
      name: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      sku: '',
      barcode: '',
      description: '',
      salesPrice: 0,
      purchasePrice: 0,
      taxRate: 0,
      unit: 'PCS',
      stock: 0,
    });
    setIsProductModalOpen(true);
  };

  const openProductEditModal = (p: Product) => {
    setProductModalMode('edit');
    setProductForm({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      description: p.description || '',
      salesPrice: p.salesPrice,
      purchasePrice: p.purchasePrice,
      taxRate: p.taxRate,
      unit: p.unit || 'PCS',
      stock: p.stock,
    });
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, ...payload } = productForm;
      if (payload.categoryId === '') {
        // Find default or allow null
        delete (payload as any).categoryId;
      }
      if (productModalMode === 'create') {
        await api.post('/products', payload);
      } else {
        await api.patch(`/products/${productForm.id}`, payload);
      }
      setIsProductModalOpen(false);
      loadData(search, selectedCategoryFilter);
    } catch (err: any) {
      alert(err.message || 'Product operation failed.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete product.');
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock <= 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400 border border-red-500/25">
          <AlertTriangle className="h-3 w-3" />
          <span>Out of Stock</span>
        </span>
      );
    } else if (stock <= 5) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-0.5 text-xs font-bold text-yellow-400 border border-yellow-500/25">
          <AlertTriangle className="h-3 w-3" />
          <span>Low Stock ({stock})</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/25">
          <span>In Stock ({stock})</span>
        </span>
      );
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(val);
  };

  return (
    <SidebarLayout>
      <FeatureGate featureKey="productsEnabled" featureName="Product Catalog">
        <div className="space-y-6 flex flex-col h-[85vh]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Products & Inventory</h1>
            <p className="mt-1 text-zinc-400 text-sm">Manage catalogs, barcode/SKUs, tax configurations and monitor stock thresholds.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-sm font-semibold text-white transition border border-zinc-700"
            >
              <FolderPlus className="h-4.5 w-4.5" />
              <span>Add Category</span>
            </button>
            <button
              onClick={openProductCreateModal}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition"
            >
              <Plus className="h-4.5 w-4.5" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Content Box */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 overflow-hidden min-h-0">
          {/* Categories Filter list (1/4 cols) */}
          <div className="md:col-span-1 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-805 shrink-0 bg-zinc-900/20">
              <h3 className="font-bold text-sm text-white">Filter by Category</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <button
                onClick={() => handleCategoryFilter('')}
                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition ${
                  selectedCategoryFilter === ''
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800/30 border border-transparent'
                }`}
              >
                All Products
              </button>
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between group">
                  <button
                    onClick={() => handleCategoryFilter(c.id)}
                    className={`flex-1 text-left px-3 py-2 text-xs font-semibold rounded-lg transition truncate ${
                      selectedCategoryFilter === c.id
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'text-zinc-400 hover:bg-zinc-805/30 border border-transparent'
                    }`}
                  >
                    {c.name}
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 text-zinc-550 hover:text-red-400 transition"
                    title="Delete Category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Products Catalog grid (3/4 cols) */}
          <div className="md:col-span-3 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex flex-col overflow-hidden">
            {/* Search and counters */}
            <div className="p-4 border-b border-zinc-805 shrink-0 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-900/20">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search name, sku, barcode..."
                  value={search}
                  onChange={handleSearchChange}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-550 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <span className="text-xs text-zinc-400 font-medium">
                Showing {products.length} product(s)
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-emerald-500 border-zinc-800" />
                </div>
              ) : products.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase bg-zinc-900/20">
                        <th className="p-4">Product Name</th>
                        <th className="p-4">SKU / Barcode</th>
                        <th className="p-4">Tax (GST)</th>
                        <th className="p-4 text-right">Sales Price</th>
                        <th className="p-4">Stock</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-800/10 transition">
                          <td className="p-4">
                            <div className="font-semibold text-white text-sm">{p.name}</div>
                            {p.category && (
                              <div className="inline-flex items-center gap-1 rounded bg-zinc-800 text-[10px] text-zinc-400 px-1.5 py-0.5 mt-1 font-medium">
                                <Tag className="h-2.5 w-2.5" />
                                {p.category.name}
                              </div>
                            )}
                          </td>
                          <td className="p-4 font-mono text-xs">
                            {p.sku && (
                              <div className="text-zinc-300 flex items-center gap-1">
                                <Hash className="h-3 w-3 text-zinc-550" />
                                <span>SKU: {p.sku}</span>
                              </div>
                            )}
                            {p.barcode && (
                              <div className="text-zinc-500 text-[10px] mt-0.5">BC: {p.barcode}</div>
                            )}
                            {!p.sku && !p.barcode && <span className="text-zinc-600">-</span>}
                          </td>
                          <td className="p-4">
                            <span className="text-xs font-bold bg-zinc-850 px-2 py-0.5 rounded text-zinc-300">
                              {p.taxRate}% GST
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-white">
                            {formatCurrency(p.salesPrice)}
                            <div className="text-[10px] text-zinc-500 font-medium mt-0.5">Purch: {formatCurrency(p.purchasePrice)}</div>
                          </td>
                          <td className="p-4">{getStockStatus(p.stock)}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openProductEditModal(p)}
                                className="p-1.5 bg-zinc-800 text-zinc-450 hover:text-white rounded transition"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-zinc-950 rounded transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-24 text-center text-zinc-500 flex flex-col items-center justify-center">
                  <Package className="h-10 w-10 text-zinc-700 mb-2" />
                  <h4 className="font-semibold text-zinc-400">No Products Found</h4>
                  <p className="text-xs mt-1">Add items to register catalog pricing and inventory parameters.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Modal */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-md font-bold text-white">Add Product Category</h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Electronics, Grocery"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Description</label>
                  <input
                    type="text"
                    value={categoryDesc}
                    onChange={(e) => setCategoryDesc(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Brief description (optional)"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="rounded-lg bg-zinc-850 text-zinc-300 px-4 py-2 text-xs font-semibold hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 text-zinc-950 px-4 py-2 text-xs font-semibold hover:bg-emerald-400"
                  >
                    Save Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Product Modal */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">
                  {productModalMode === 'create' ? 'Add New Product' : 'Edit Product Details'}
                </h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleProductSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-zinc-300">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. Dell Inspiron 15"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">Category</label>
                    <select
                      value={productForm.categoryId}
                      onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">No Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">Stock Unit (e.g. PCS, KG)</label>
                    <input
                      type="text"
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                      placeholder="PCS"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">SKU Code</label>
                    <input
                      type="text"
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                      placeholder="e.g. LAP-DELL-15"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">Barcode (EAN / UPC)</label>
                    <input
                      type="text"
                      value={productForm.barcode}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                      placeholder="e.g. 8901234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">Purchase Price (Excl. Tax)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.purchasePrice}
                      onChange={(e) => setProductForm({ ...productForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">Sales Price (Excl. Tax)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.salesPrice}
                      onChange={(e) => setProductForm({ ...productForm, salesPrice: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">Tax Rate (GST %)</label>
                    <select
                      value={productForm.taxRate}
                      onChange={(e) => setProductForm({ ...productForm, taxRate: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="0">0% Exempt</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">Opening Stock Quantity</label>
                    <input
                      type="number"
                      value={productForm.stock}
                      onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="rounded-lg bg-zinc-850 text-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 text-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-emerald-400"
                  >
                    Save Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      </FeatureGate>
    </SidebarLayout>
  );
}
