/**
* @license
* SPDX-License-Identifier: Apache-2.0
*/
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
Package,
TrendingUp,
TrendingDown,
DollarSign,
Plus,
Trash2,
AlertCircle,
PieChart,
Loader2
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

interface Product {
id: string;
name: string;
purchasePrice: number;
sellingPrice: number;
stock: number;
weeklySales: number;
}

export default function App() {
const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(true);
const [submitting, setSubmitting] = useState(false);
const [formData, setFormData] = useState({
name: '',
purchasePrice: '',
sellingPrice: '',
stock: '',
weeklySales: ''
});

// Fetch products from Supabase
useEffect(() => {
  fetchProducts();
}, []);

async function fetchProducts() {
  try {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data) {
      const mappedProducts: Product[] = data.map(p => ({
        id: p.id,
        name: p.name,
        purchasePrice: Number(p.purchase_price),
        sellingPrice: Number(p.selling_price),
        stock: Number(p.stock),
        weeklySales: Number(p.weekly_sales)
      }));
      setProducts(mappedProducts);
    }
  } catch (err) {
    console.error('Error fetching products:', err);
    alert('Erro ao carregar produtos. Verifique sua conexão.');
  } finally {
    setLoading(false);
  }
}

const handleAddField = async (e: React.FormEvent) => {
e.preventDefault();
if (!formData.name || !formData.purchasePrice || !formData.sellingPrice || !formData.stock || !formData.weeklySales) return;

try {
  setSubmitting(true);
  const newProductData = {
    name: formData.name,
    purchase_price: Number(formData.purchasePrice),
    selling_price: Number(formData.sellingPrice),
    stock: Number(formData.stock),
    weekly_sales: Number(formData.weeklySales)
  };

  const { data, error } = await supabase
    .from('products')
    .insert([newProductData])
    .select();

  if (error) throw error;

  if (data && data[0]) {
    const newProduct: Product = {
      id: data[0].id,
      name: data[0].name,
      purchasePrice: Number(data[0].purchase_price),
      sellingPrice: Number(data[0].selling_price),
      stock: Number(data[0].stock),
      weeklySales: Number(data[0].weekly_sales)
    };
    setProducts([newProduct, ...products]);
    setFormData({
      name: '',
      purchasePrice: '',
      sellingPrice: '',
      stock: '',
      weeklySales: ''
    });
  }
} catch (err) {
  console.error('Error adding product:', err);
  alert('Erro ao adicionar produto.');
} finally {
  setSubmitting(false);
}
};

const removeProduct = async (id: string) => {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;
  
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    setProducts(products.filter(p => p.id !== id));
  } catch (err) {
    console.error('Error removing product:', err);
    alert('Erro ao excluir produto.');
  }
};

const analysis = useMemo(() => {
if (products.length === 0) return null;

const trappedMoney = products.reduce((acc, p) => acc + (p.stock * p.purchasePrice), 0);

// Sorting logic
const sortedByTurnover = [...products].sort((a, b) => (b.stock / (b.weeklySales || 0.1)) - (a.stock / (a.weeklySales || 0.1)));
const worstProduct = sortedByTurnover[0];
const bestProduct = sortedByTurnover[sortedByTurnover.length - 1];

const isWorstLowTurnover = (worstProduct.stock / (worstProduct.weeklySales || 0.1)) > 4;
const isBestHighTurnover = (bestProduct.stock / (bestProduct.weeklySales || 0.1)) <= 4;

let sentences = [];
sentences.push(`Você tem R$ ${trappedMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em mercadoria parada no estoque agora.`);

if (worstProduct.id === bestProduct.id) {
  // Case with only one product or all identical
  if (isWorstLowTurnover) {
    sentences.push(`${worstProduct.name} está com giro baixo. Cuidado com capital parado.`);
  } else {
    sentences.push(`${worstProduct.name} está com um giro saudável.`);
  }
} else {
  sentences.push(`${worstProduct.name} está travando seu capital com baixo giro.`);
  if (isBestHighTurnover) {
    sentences.push(`O produto ${bestProduct.name} está vendendo bem e merece atenção no estoque.`);
  }
}

return {
trappedMoney,
worstProduct,
bestProduct: worstProduct.id === bestProduct.id ? null : bestProduct,
isWorstLowTurnover,
isBestHighTurnover,
sentences
};
}, [products]);

return (
<div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans p-6 md:p-12">
<div className="max-w-4xl mx-auto space-y-8">
{/* Header */}
<header className="space-y-2">
<div className="flex items-center gap-3">
<div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-100">
<PieChart className="w-6 h-6 text-white" />
</div>
<h1 className="text-2xl font-bold tracking-tight text-slate-800">Analista de Estoque</h1>
</div>
<p className="text-slate-500">Transforme seus números em lucro e capital livre.</p>
</header>

<div className="grid md:grid-cols-[1fr_350px] gap-8">
{/* Main Content */}
<div className="space-y-8">
{/* Analysis Summary */}
<AnimatePresence mode="wait">
{loading ? (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-4"
  >
    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
    <p className="text-slate-500 font-medium">Sincronizando com o banco de dados...</p>
  </motion.div>
) : analysis ? (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
>
<div className="flex items-center justify-between">
<h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Diagnóstico Direto</h2>
<span className="flex items-center gap-1 text-xs font-medium px-2 py-1 bg-green-50 text-green-700 rounded-full">
<AlertCircle className="w-3 h-3" />
Dados em Nuvem
</span>
</div>
<div className="space-y-3">
{analysis.sentences.map((s, i) => (
<p key={i} className="text-lg font-medium text-slate-700 leading-snug">
{s}
</p>
))}
</div>
<div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
{analysis.isWorstLowTurnover && (
  <div className="p-4 bg-red-50 rounded-xl border border-red-100 space-y-1">
    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Ação Corretiva</p>
    <p className="text-sm text-red-800">Reduzir compra ou fazer promoção de {analysis.worstProduct.name}.</p>
  </div>
)}
{analysis.bestProduct && analysis.isBestHighTurnover && (
  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-1">
    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Ação Estratégica</p>
    <p className="text-sm text-indigo-800">Reforçar estoque de {analysis.bestProduct.name} para não faltar.</p>
  </div>
)}
</div>
</motion.div>
) : (
<motion.div
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
className="bg-slate-100 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-4"
>
<div className="mx-auto w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
<Package className="w-6 h-6 text-slate-400" />
</div>
<div>
<h3 className="font-semibold text-slate-600">Nenhum dado ainda</h3>
<p className="text-sm text-slate-500">Adicione seus produtos ao lado para ver o diagnóstico.</p>
</div>
</motion.div>
)}
</AnimatePresence>

{/* List Table */}
{!loading && products.length > 0 && (
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
<div className="p-4 border-b border-slate-100 flex items-center justify-between">
<h2 className="font-semibold text-slate-700">Seu Inventário</h2>
<span className="text-xs text-slate-400">{products.length} itens</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-slate-50/50 text-xs font-semibold uppercase text-slate-400 tracking-wider">
<th className="px-6 py-3">Produto</th>
<th className="px-6 py-3 text-right">Estoque</th>
<th className="px-6 py-3 text-right">Média/Sem</th>
<th className="px-6 py-3 text-right">Giro</th>
<th className="px-6 py-3 w-10"></th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
{products.map((p) => {
const weeksOfStock = p.weeklySales > 0 ? p.stock / p.weeklySales : Infinity;
const isLowTurnover = weeksOfStock > 4;
return (
<tr key={p.id} className="group hover:bg-slate-50 transition-colors">
<td className="px-6 py-4">
<p className="font-medium text-slate-800">{p.name}</p>
<p className="text-[10px] text-slate-400">Custo: R$ {p.purchasePrice.toFixed(2)}</p>
</td>
<td className="px-6 py-4 text-right text-sm font-medium text-slate-600">
{p.stock}
</td>
<td className="px-6 py-4 text-right text-sm text-slate-500">
{p.weeklySales}
</td>
<td className="px-6 py-4 text-right">
<span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
isLowTurnover
? 'bg-orange-50 text-orange-600'
: 'bg-green-50 text-green-600'
}`}>
{isLowTurnover ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
{weeksOfStock === Infinity ? 'Sem Vendas' : `${weeksOfStock.toFixed(1)} sem.`}
</span>
</td>
<td className="px-6 py-4 text-right">
<button
onClick={() => removeProduct(p.id)}
className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
>
<Trash2 className="w-4 h-4" />
</button>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>
)}
</div>

{/* Sidebar Form */}
<aside className="space-y-4">
<div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
<div className="flex items-center gap-2">
<Plus className="w-4 h-4 text-indigo-600" />
<h2 className="font-semibold text-slate-800 text-sm">Adicionar Produto</h2>
</div>
<form onSubmit={handleAddField} className="space-y-4">
<div className="space-y-1.5">
<label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nome do Produto</label>
<input
type="text"
required
value={formData.name}
onChange={(e) => setFormData({...formData, name: e.target.value})}
placeholder="Ex: Cimento CP-II"
className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
/>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="space-y-1.5">
<label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Preço Compra</label>
<div className="relative">
<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
<input
type="number"
required
min="0"
step="0.01"
value={formData.purchasePrice}
onChange={(e) => setFormData({...formData, purchasePrice: e.target.value})}
placeholder="0.00"
className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
/>
</div>
</div>
<div className="space-y-1.5">
<label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Preço Venda</label>
<div className="relative">
<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
<input
type="number"
required
min="0"
step="0.01"
value={formData.sellingPrice}
onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
placeholder="0.00"
className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
/>
</div>
</div>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="space-y-1.5">
<label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qtd Estoque</label>
<input
type="number"
required
min="0"
value={formData.stock}
onChange={(e) => setFormData({...formData, stock: e.target.value})}
placeholder="0"
className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
/>
</div>
<div className="space-y-1.5">
<label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Média Vendas/Sem</label>
<input
type="number"
required
min="0"
value={formData.weeklySales}
onChange={(e) => setFormData({...formData, weeklySales: e.target.value})}
placeholder="0"
className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
/>
</div>
</div>
<button
type="submit"
disabled={submitting}
className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
>
{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
{submitting ? 'Salvando...' : 'Adicionar ao Painel'}
</button>
</form>
</div>

<div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl shadow-indigo-100 overflow-hidden relative">
<div className="relative z-10 space-y-4">
<div className="flex items-center gap-2">
<DollarSign className="w-4 h-4 text-indigo-400" />
<h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">Capital Travado</h3>
</div>
<div>
<p className="text-3xl font-bold tracking-tight">
R$ {analysis ? analysis.trappedMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
</p>
<p className="text-[10px] text-slate-400 mt-1">Este dinheiro poderia estar rendendo ou sendo reinvestido.</p>
</div>
</div>
<div className="absolute -right-8 -bottom-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
</div>
</aside>
</div>

<footer className="pt-8 border-t border-slate-200">
<div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
<p>© 2026 Gestão de Estoque Inteligente</p>
<div className="flex items-center gap-4">
<p>Simples • Direto • Lucrativo</p>
</div>
</div>
</footer>
</div>
</div>
);
}
