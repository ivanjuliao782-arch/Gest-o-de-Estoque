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
  Loader2,
  Search,
  X
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    purchasePrice: '',
    sellingPrice: '',
    stock: '',
    weeklySales: ''
  });

  // Get Store ID from URL or default to 'global'
  const storeId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || 'global';
  }, []);

  // Fetch products from Supabase
  useEffect(() => {
    fetchProducts();

    // Realtime subscription — atualiza automaticamente quando qualquer mudança ocorre
    const channel = supabase
      .channel(`products-realtime-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${storeId}`
        },
        () => {
          // Recarrega todos os produtos quando qualquer mudança ocorrer
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  async function fetchProducts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
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
        weekly_sales: Number(formData.weeklySales),
        store_id: storeId
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

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

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
    <div className="min-h-screen bg-[#050505] text-slate-100 font-sans p-4 md:p-12 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] md:w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] md:w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

      {!isSupabaseConfigured && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 backdrop-blur text-white text-center text-xs font-bold py-2 px-4">
          ⚠️ Variáveis de ambiente do Supabase não configuradas no Vercel. Acesse as configurações do projeto.
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 relative z-10">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
              <PieChart className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Analista de Estoque <span className="text-indigo-400">Pro</span></h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400">Maximize seu lucro com inteligência de dados.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-6 md:gap-8">
          {/* Main Content */}
          <div className="space-y-6 md:space-y-8 order-2 md:order-1">
            {/* Analysis Summary */}
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-slate-900/40 backdrop-blur-xl p-8 md:p-12 rounded-3xl border border-white/5 shadow-2xl flex flex-col items-center justify-center gap-4"
                >
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">Sincronizando dados...</p>
                </motion.div>
              ) : analysis ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-slate-900/40 backdrop-blur-xl p-5 md:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Diagnóstico Estratégico</h2>
                    <span className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold px-2 md:px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-full border border-indigo-500/20">
                      <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                      Cloud Sync
                    </span>
                  </div>
                  <div className="space-y-3 md:space-y-4">
                    {analysis.sentences.map((s, i) => (
                      <p key={i} className="text-base md:text-xl font-medium text-slate-100 leading-relaxed">
                        {s}
                      </p>
                    ))}
                  </div>
                  <div className="pt-5 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {analysis.isWorstLowTurnover && (
                      <div className="p-3 md:p-4 bg-red-500/5 rounded-2xl border border-red-500/10 space-y-1">
                        <p className="text-[9px] md:text-[10px] font-bold text-red-400 uppercase tracking-widest">Ação Imediata</p>
                        <p className="text-xs md:text-sm text-red-200/80">Promover {analysis.worstProduct.name} para liberar caixa.</p>
                      </div>
                    )}
                    {analysis.bestProduct && analysis.isBestHighTurnover && (
                      <div className="p-3 md:p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-1">
                        <p className="text-[9px] md:text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Oportunidade</p>
                        <p className="text-xs md:text-sm text-emerald-200/80">Escalar estoque de {analysis.bestProduct.name}.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-slate-900/20 border-2 border-dashed border-white/5 rounded-3xl p-10 md:p-16 text-center space-y-4"
                >
                  <div className="mx-auto w-12 h-12 md:w-14 md:h-14 bg-slate-800/50 rounded-2xl flex items-center justify-center">
                    <Package className="w-6 h-6 md:w-7 md:h-7 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-300">Sem dados no radar</h3>
                    <p className="text-xs md:text-sm text-slate-500">Alimente o sistema para gerar o diagnóstico.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List Table */}
            {!loading && products.length > 0 && (
              <div className="bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5 space-y-4 bg-white/2">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-slate-200">Inventário Ativo</h2>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md uppercase">
                      {filteredProducts.length}/{products.length} Itens
                    </span>
                  </div>
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar produto..."
                      className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/10 transition-all text-sm text-white placeholder:text-slate-600"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {searchQuery && filteredProducts.length === 0 && (
                    <p className="text-center text-slate-500 text-sm py-1">Nenhum produto encontrado para "{searchQuery}"</p>
                  )}
                </div>

                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/2 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
                        <th className="px-6 py-4">Produto</th>
                        <th className="px-6 py-4 text-right">Estoque</th>
                        <th className="px-6 py-4 text-right">Giro</th>
                        <th className="px-6 py-4 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredProducts.map((p) => {
                        const weeksOfStock = p.weeklySales > 0 ? p.stock / p.weeklySales : Infinity;
                        const isLowTurnover = weeksOfStock > 4;
                        return (
                          <tr key={p.id} className="group hover:bg-white/2 transition-colors">
                            <td className="px-6 py-5">
                              <p className="font-semibold text-slate-200">{p.name}</p>
                              <p className="text-[10px] font-medium text-slate-500">Custo: R$ {p.purchasePrice.toFixed(2)}</p>
                            </td>
                            <td className="px-6 py-5 text-right text-sm font-bold text-slate-300">
                              {p.stock}
                            </td>
                            <td className="px-6 py-5 text-right">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isLowTurnover
                                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                {isLowTurnover ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                                {weeksOfStock === Infinity ? '0 Vendas' : `${weeksOfStock.toFixed(1)} sem.`}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <button
                                onClick={() => removeProduct(p.id)}
                                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
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

                {/* Mobile View Card List */}
                <div className="md:hidden divide-y divide-white/5">
                  {filteredProducts.map((p) => {
                    const weeksOfStock = p.weeklySales > 0 ? p.stock / p.weeklySales : Infinity;
                    const isLowTurnover = weeksOfStock > 4;
                    return (
                      <div key={p.id} className="p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-100">{p.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Custo: R$ {p.purchasePrice.toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => removeProduct(p.id)}
                            className="p-2 text-slate-600 hover:text-red-400 active:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estoque</span>
                            <span className="text-lg font-black text-slate-200">{p.stock}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Giro de Capital</span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isLowTurnover
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                              {isLowTurnover ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                              {weeksOfStock === Infinity ? 'Zero Vendas' : `${weeksOfStock.toFixed(1)} semanas`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Form */}
          <aside className="space-y-6 order-1 md:order-2">
            <div className="bg-slate-900/60 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                <h2 className="font-bold text-white text-sm uppercase tracking-widest">Novo Item</h2>
              </div>
              <form onSubmit={handleAddField} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Cimento CP-II"
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/10 transition-all text-sm text-white placeholder:text-slate-600"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Preços (Custo/Venda)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={formData.purchasePrice}
                          onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                          placeholder="Custo"
                          className="w-full pl-9 pr-3 py-3 bg-white/5 border border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/10 transition-all text-sm text-white placeholder:text-slate-600"
                        />
                      </div>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={formData.sellingPrice}
                          onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                          placeholder="Venda"
                          className="w-full pl-9 pr-3 py-3 bg-white/5 border border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/10 transition-all text-sm text-white placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Estoque</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/10 transition-all text-sm text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Vendas/Semana</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.weeklySales}
                        onChange={(e) => setFormData({ ...formData, weeklySales: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/10 transition-all text-sm text-white"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {submitting ? 'PROCESSANDO...' : 'REGISTRAR PRODUTO'}
                </button>
              </form>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 md:p-8 rounded-3xl text-white shadow-2xl shadow-indigo-500/20 overflow-hidden relative group">
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-white/60" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Capital Imobilizado</h3>
                </div>
                <div>
                  <p className="text-3xl md:text-4xl font-black tracking-tighter">
                    R$ {analysis ? analysis.trappedMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                  </p>
                  <p className="text-[9px] md:text-[10px] font-bold text-white/40 mt-2 uppercase tracking-widest leading-relaxed">
                    Recursos que poderiam estar gerando lucro agora.
                  </p>
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
            </div>
          </aside>
        </div>

        <footer className="pt-8 md:pt-12 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 text-center md:text-left">
            <p>© 2026 GESTÃO INTELIGENTE @SHOCKWAVE</p>
            <div className="flex items-center gap-4 md:gap-6">
              <p>Inovação</p>
              <p>Performance</p>
              <p>Resultados</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
