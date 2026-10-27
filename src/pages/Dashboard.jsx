import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BASE_URL } from '../services/api';

// Importações para o Gerador de PDF
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // <-- CORREÇÃO 1: Importado como função
import html2canvas from 'html2canvas';

function Dashboard() {
  const [produtos, setProdutos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const navigate = useNavigate();
  
  // Referência para "fotografar" a área dos gráficos
  const graficosRef = useRef(null);

  useEffect(() => {
    buscarDados();
  }, []);

  const buscarDados = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/');

    try {
      const [resProdutos, resVendas] = await Promise.all([
        fetch(BASE_URL + '/api/produtos', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(BASE_URL + '/api/vendas', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (resProdutos.ok && resVendas.ok) {
        const dadosProdutos = await resProdutos.json();
        const dadosVendas = await resVendas.json();
        
        setProdutos(dadosProdutos);
        setVendas(dadosVendas);
      }
    } catch (erro) {
        console.error('Erro ao buscar dados do Dashboard', erro);
    } finally {
        setCarregando(false);
    }
  };

  // --- LÓGICA PARA GERAR O BALANÇO EM PDF ---
  const gerarBalancoPDF = async () => {
    setGerandoPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dataAtual = new Date().toLocaleString('pt-PT');

      // 1. Cabeçalho do Relatório
      doc.setFontSize(22);
      doc.setTextColor(142, 68, 173); // Roxo do sistema
      doc.text('Balanço Contabilístico de Vendas', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Documento gerado a: ${dataAtual} | Nexo Gestão`, 14, 28);

      // 2. Resumo Financeiro (Cálculos)
      const faturamentoTotal = vendas.reduce((acc, v) => acc + (v.total || 0), 0);
      const totalPedidos = vendas.length;
      const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0;

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text(`Faturação Total: R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`, 14, 40);
      doc.text(`Total de Pedidos Realizados: ${totalPedidos}`, 14, 46);
      doc.text(`Ticket Médio por Venda: R$ ${ticketMedio.toFixed(2).replace('.', ',')}`, 14, 52);

      // 3. Capturar Gráficos como Imagem
      let startY = 60;
      if (graficosRef.current) {
        const canvas = await html2canvas(graficosRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        
        const imgWidth = 182; // Largura A4 com margens
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        doc.addImage(imgData, 'PNG', 14, startY, imgWidth, imgHeight);
        startY += imgHeight + 15; // Atualiza a posição Y para a tabela
      }

      // 4. Livro Razão (Tabela de Vendas)
      doc.setFontSize(14);
      doc.setTextColor(142, 68, 173);
      doc.text('Livro Razão - Histórico de Transações', 14, startY - 5);

      const colunas = ['ID da Venda', 'Forma de Pagamento', 'Qtd. Itens', 'Valor Total (R$)'];
      const linhas = vendas.map(v => {
        const qtdItens = v.itens ? v.itens.reduce((acc, i) => acc + i.quantidade, 0) : (v.itensVenda ? v.itensVenda.length : 0);
        return [
          `#${v.id || '-'}`,
          v.formaPagamento || 'N/A',
          qtdItens.toString(),
          (v.total || 0).toFixed(2).replace('.', ',')
        ];
      });

      // --- CORREÇÃO 2: Chamada da tabela usando a nova sintaxe ---
      autoTable(doc, {
        startY: startY,
        head: [colunas],
        body: linhas,
        theme: 'grid',
        headStyles: { fillColor: [142, 68, 173] },
        styles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [249, 245, 250] }
      });

      // 5. Descarregar o ficheiro
      doc.save('Balanco_Vendas_Nexo.pdf');
    } catch (erro) {
      console.error('Erro ao gerar o relatório:', erro);
      alert('Ocorreu um erro ao processar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  // --- MATEMÁTICA DO DASHBOARD (KPIs) ---
  const hoje = new Date().toISOString().split('T')[0];
  const ofertasAtivas = produtos.filter(p => 
    p.precoPromocional && p.dataInicioPromocao && p.dataFimPromocao && 
    hoje >= p.dataInicioPromocao && hoje <= p.dataFimPromocao
  ).length;

  const totalProdutosCadastrados = produtos.length;
  const valorTotalEstoque = produtos.reduce((acc, p) => acc + (p.preco * p.estoque), 0);
  const produtosEstoqueBaixo = produtos.filter(p => p.estoque > 0 && p.estoque <= 5).length;
  const produtosEsgotados = produtos.filter(p => p.estoque === 0).length;

  // --- PREPARANDO DADOS: GRÁFICOS ---
  const contagemCategorias = produtos.reduce((acc, p) => {
    const nomeCat = p.categoria ? p.categoria.nome : 'Sem Categoria';
    acc[nomeCat] = (acc[nomeCat] || 0) + 1;
    return acc;
  }, {});
  
  const dadosGraficoPizza = Object.keys(contagemCategorias).map(chave => ({
    name: chave,
    quantidade: contagemCategorias[chave]
  }));

  const receitaPorCategoria = {};
  vendas.forEach(venda => {
      const listaItens = venda.itens || venda.itensVenda || [];
      listaItens.forEach(item => {
      const idDoProduto = item.produto ? item.produto.id : item.produtoId;
      const produtoReferencia = produtos.find(p => String(p.id) === String(idDoProduto));
      
      let nomeCat = 'Sem Categoria';
      if (item.produto && item.produto.categoria && item.produto.categoria.nome) {
          nomeCat = item.produto.categoria.nome;
      } else if (produtoReferencia && produtoReferencia.categoria && produtoReferencia.categoria.nome) {
          nomeCat = produtoReferencia.categoria.nome;
      }

      const valorSubtotal = item.subtotal || (item.quantidade * (item.precoUnitario || 0)) || 0;
      receitaPorCategoria[nomeCat] = (receitaPorCategoria[nomeCat] || 0) + valorSubtotal;
      });
  });

  const dadosGraficoBarras = Object.keys(receitaPorCategoria).map(chave => ({
      name: chave,
      receita: receitaPorCategoria[chave]
  }));

  const CORES = ['#8e44ad', '#3498db', '#2ecc71', '#f1c40f', '#e74c3c'];

  if (carregando) return <div style={{ padding: '50px', textAlign: 'center' }}>A carregar métricas...</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Visão Geral
              </div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Dashboard Analítico</h1>
            </div>
            
            {/* BOTÃO PARA DESCARREGAR O RELATÓRIO PDF */}
            <button 
              onClick={gerarBalancoPDF} 
              disabled={gerandoPdf}
              style={{ 
                padding: '12px 24px', backgroundColor: gerandoPdf ? '#ccc' : '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: gerandoPdf ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(142,68,173,0.3)', transition: 'background 0.3s ease' 
              }}>
              {gerandoPdf ? 'A processar documento...' : '📄 Baixar Balanço Contabilístico'}
            </button>
          </div>

          {/* CARDS DE INDICADORES */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '5px solid #2ecc71' }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: 'bold', marginBottom: '10px' }}>VALOR TOTAL EM ESTOQUE</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '5px solid #3498db' }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: 'bold', marginBottom: '10px' }}>PRODUTOS REGISTADOS</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>{totalProdutosCadastrados}</div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '5px solid #f1c40f' }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: 'bold', marginBottom: '10px' }}>ESTOQUE BAIXO (≤ 5)</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f39c12' }}>{produtosEstoqueBaixo}</div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '5px solid #e74c3c' }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: 'bold', marginBottom: '10px' }}>PRODUTOS ESGOTADOS</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e74c3c' }}>{produtosEsgotados}</div>
            </div>

            <div style={{ backgroundColor: '#fff5f5', padding: '20px', borderRadius: '15px', border: '1px solid #ffb8b8', flex: 1, minWidth: '150px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#d63031', fontSize: '14px', textTransform: 'uppercase' }}>🏷️ Ofertas Ativas</h3>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>{ofertasAtivas}</span>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#d63031' }}>Produtos com desconto hoje</p>
            </div>
          </div>

          {/* ÁREA DE GRÁFICOS COM REF PARA CAPTURA DO PDF */}
          <div ref={graficosRef} style={{ display: 'flex', gap: '20px', marginTop: '10px', backgroundColor: '#f4f7f6', padding: '10px', borderRadius: '15px' }}>
            
            {/* GRÁFICO DE BARRAS */}
            <div style={{ flex: 2, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '5px' }}>Receita por Categoria (R$)</h3>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px', marginTop: 0 }}>Quais categorias geram mais faturação</p>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGraficoBarras} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#fcf9ff'}} 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'}} 
                      formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <Bar dataKey="receita" fill="#2ecc71" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICO DE PIZZA */}
            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '5px' }}>Volume do Catálogo</h3>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px', marginTop: 0 }}>Quantidade de produtos registados</p>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosGraficoPizza} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="quantidade">
                      {dadosGraficoPizza.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;