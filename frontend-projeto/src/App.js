/**
 * OLD SCHOOL GARAGE — Sistema de Controle de Estoque
 * Frontend: React 18
 * Versão: 2.0.0
 * Conformidade: LGPD (Lei 13.709/2018)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  LayoutDashboard, Package, Users, Truck, Link2, ShoppingCart,
  Edit3, Trash2, XCircle, AlertTriangle, CheckCircle, Info,
  Search, RefreshCw, Shield, ChevronRight, X, Plus, Minus,
  FileText, UserX
} from 'lucide-react';
import logoImg from './logo_garage.png';

// ─── Configuração ─────────────────────────────────────────────────────────────
const API = 'http://localhost:3000';
const CATEGORIAS = ['PEÇAS', 'ACESSÓRIOS', 'ELÉTRICA', 'SUSPENSÃO', 'MOTOR', 'FREIOS', 'FUNILARIA', 'PINTURA', 'FLUIDOS', 'FERRAMENTAS', 'OUTRO'];

const C = {
  accent:  '#ff4d00',
  dark:    '#111111',
  card:    '#ffffff',
  bg:      '#f0f0f0',
  border:  '#e0e0e0',
  text:    '#1a1a1a',
  muted:   '#888888',
  success: '#16a34a',
  danger:  '#dc2626',
  warn:    '#d97706',
};

// ─── Utilitários de máscara ────────────────────────────────────────────────────
const masks = {
  cnpj:     v => v.replace(/\D/g,'').slice(0,14).replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d)/,'$1-$2'),
  cpf:      v => v.replace(/\D/g,'').slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1-$2'),
  tel:      v => { const n=v.replace(/\D/g,'').slice(0,11); return n.length>10?n.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'):n.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3'); },
  barras:   v => v.replace(/\D/g,'').slice(0,13),
  numero:   v => v.replace(/\D/g,''),
  moeda:    v => { const n=parseFloat(v.replace(/\D/g,''))/100; return isNaN(n)?'0,00':n.toLocaleString('pt-BR',{minimumFractionDigits:2}); },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
let _setToast = () => {};
const toast = {
  success: m => _setToast({ msg: m, type: 'success' }),
  error:   m => _setToast({ msg: m, type: 'error' }),
  info:    m => _setToast({ msg: m, type: 'info' }),
};

function Toast() {
  const [t, setT] = useState(null);
  useEffect(() => { _setToast = setT; }, []);
  useEffect(() => { if (t) { const id = setTimeout(() => setT(null), 4000); return () => clearTimeout(id); } }, [t]);
  if (!t) return null;
  const cfg = { success: { bg: C.success, Icon: CheckCircle }, error: { bg: C.danger, Icon: XCircle }, info: { bg: '#1d4ed8', Icon: Info } }[t.type];
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', alignItems:'center', gap:10,
      backgroundColor: cfg.bg, color:'#fff', padding:'14px 20px', borderRadius:10,
      boxShadow:'0 8px 30px rgba(0,0,0,0.25)', maxWidth:380, fontWeight:600, fontSize:14, animation:'fadeUp .3s ease' }}>
      <cfg.Icon size={18}/> {t.msg}
    </div>
  );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.6)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ backgroundColor:C.card, borderRadius:12, width:'100%', maxWidth: wide?720:500,
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'20px 24px', borderBottom:`1px solid ${C.border}` }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:C.text, textTransform:'uppercase', letterSpacing:1 }}>{title}</h3>
          <X size={20} style={{ cursor:'pointer', color:C.muted }} onClick={onClose}/>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Campo de formulário ──────────────────────────────────────────────────────
function Field({ label, error, children, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color: error ? C.danger : C.muted,
        marginBottom:4, textTransform:'uppercase', letterSpacing:.5 }}>
        {label}{required && <span style={{ color:C.accent }}> *</span>}
      </label>
      {children}
      {error && <p style={{ margin:'4px 0 0', fontSize:11, color:C.danger }}>{error}</p>}
    </div>
  );
}

const inputSt = (error) => ({
  width:'100%', padding:'10px 12px', border:`1.5px solid ${error ? C.danger : C.border}`,
  borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
  transition:'border-color .2s', backgroundColor:'#fafafa',
});

// ─── Botões ───────────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant='primary', small, type='button', disabled }) => {
  const bg = { primary:C.accent, dark:C.dark, ghost:'transparent', danger:C.danger }[variant];
  const cl = { primary:'#fff', dark:'#fff', ghost:C.text, danger:'#fff' }[variant];
  const bd = { ghost:`1.5px solid ${C.border}` }[variant] || 'none';
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{
      padding: small?'7px 14px':'11px 20px', backgroundColor:disabled?C.border:bg, color:disabled?C.muted:cl,
      border:bd, borderRadius:7, fontWeight:700, fontSize: small?12:13, cursor:disabled?'not-allowed':'pointer',
      display:'inline-flex', alignItems:'center', gap:6, transition:'opacity .2s',
      textTransform:'uppercase', letterSpacing:.5, fontFamily:'inherit'
    }}>{children}</button>
  );
};

// ─── Tabela ───────────────────────────────────────────────────────────────────
function Tabela({ cols, rows, onEdit, onDelete, extraActions }) {
  return (
    <div style={{ overflowX:'auto', marginTop:20 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ backgroundColor:'#f8f8f8', borderBottom:`2px solid ${C.border}` }}>
            {cols.map(c => <th key={c.key} style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:.5, whiteSpace:'nowrap' }}>{c.label}</th>)}
            <th style={{ padding:'10px 12px' }}>AÇÕES</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length+1} style={{ textAlign:'center', padding:32, color:C.muted, fontSize:13 }}>Nenhum registro encontrado.</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.ID || i} style={{ borderBottom:`1px solid ${C.border}`, transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor='#fafafa'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
              {cols.map(c => (
                <td key={c.key} style={{ padding:'10px 12px', color:C.text, verticalAlign:'middle' }}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
              <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                {onEdit && <Edit3 size={15} onClick={() => onEdit(row)} style={{ cursor:'pointer', color:C.accent, marginRight:12 }}/>}
                {extraActions && extraActions(row)}
                {onDelete && <Trash2 size={15} onClick={() => onDelete(row.ID)} style={{ cursor:'pointer', color:C.danger }}/>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modal LGPD ───────────────────────────────────────────────────────────────
function ModalLGPD({ onAceitar, onFechar }) {
  return (
    <Modal title="Política de Privacidade — LGPD" onClose={onFechar} wide>
      <div style={{ fontSize:13, lineHeight:1.7, color:C.text }}>
        <div style={{ display:'flex', gap:10, backgroundColor:'#fff7ed', border:`1px solid #fed7aa`, borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
          <Shield size={18} style={{ color:C.warn, flexShrink:0, marginTop:2 }}/>
          <p style={{ margin:0, fontSize:12 }}>Em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</strong>, informamos como seus dados serão tratados.</p>
        </div>
        <h4 style={{ margin:'0 0 6px', fontSize:13 }}>1. Dados coletados</h4>
        <p style={{ margin:'0 0 12px', color:C.muted }}>Nome, CPF (armazenado de forma criptografada), telefone, e-mail e endereço, utilizados exclusivamente para gestão de vendas e relacionamento comercial.</p>
        <h4 style={{ margin:'0 0 6px', fontSize:13 }}>2. Finalidade do tratamento</h4>
        <p style={{ margin:'0 0 12px', color:C.muted }}>Os dados são coletados com base no <strong>Art. 7º, I (consentimento)</strong> da LGPD para execução do contrato de prestação de serviços.</p>
        <h4 style={{ margin:'0 0 6px', fontSize:13 }}>3. Seus direitos (Art. 18)</h4>
        <p style={{ margin:'0 0 12px', color:C.muted }}>Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados a qualquer momento diretamente em nosso sistema.</p>
        <h4 style={{ margin:'0 0 6px', fontSize:13 }}>4. Segurança</h4>
        <p style={{ margin:'0 0 20px', color:C.muted }}>Os dados são armazenados localmente com criptografia AES. Nenhum dado é compartilhado com terceiros.</p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={onFechar}>Recusar</Btn>
          <Btn onClick={onAceitar}><CheckCircle size={15}/> Aceitar e Continuar</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/dashboard`); setStats(r.data); } catch { toast.error('Erro ao carregar dashboard'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const KPI = ({ label, value, sub, color }) => (
    <div style={{ backgroundColor:C.card, borderRadius:10, padding:'20px 24px', borderLeft:`4px solid ${color||C.accent}`, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
      <p style={{ margin:0, fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:.5 }}>{label}</p>
      <p style={{ margin:'8px 0 0', fontSize:28, fontWeight:900, color:C.text }}>{value}</p>
      {sub && <p style={{ margin:'4px 0 0', fontSize:12, color:C.muted }}>{sub}</p>}
    </div>
  );

  if (!stats) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Carregando...</div>;

  return (
    <div>
      <h2 style={titSt}>Dashboard</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:24 }}>
        <KPI label="Produtos Cadastrados" value={stats.total_produtos} color={C.accent}/>
        <KPI label="Fornecedores Ativos" value={stats.total_fornecedores} color="#7c3aed"/>
        <KPI label="Clientes Cadastrados" value={stats.total_clientes} color="#0891b2"/>
        <KPI label="Total em Vendas" value={`R$ ${Number(stats.total_vendas||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`} sub={`${stats.qtd_vendas} transações`} color={C.success}/>
      </div>

      {stats.estoque_baixo?.length > 0 && (
        <div style={{ backgroundColor:'#fff7ed', border:`1px solid #fed7aa`, borderRadius:10, padding:'16px 20px', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <AlertTriangle size={18} style={{ color:C.warn }}/>
            <span style={{ fontWeight:800, color:C.warn, textTransform:'uppercase', fontSize:13 }}>Alerta: Estoque Baixo</span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {stats.estoque_baixo.map(p => (
              <span key={p.ID} style={{ backgroundColor:'#fed7aa', color:'#9a3412', padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                {p.NOME_PRODUTO} — {p.QUANTIDADE} un.
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.vendas_recentes?.length > 0 && (
        <div style={{ backgroundColor:C.card, borderRadius:10, padding:'20px 24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:13, fontWeight:800, textTransform:'uppercase', color:C.muted, letterSpacing:.5 }}>Últimas Vendas</h3>
          {stats.vendas_recentes.map((v, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
              <span><strong>{v.NOME_PRODUTO}</strong>{v.NOME_COMPLETO ? ` — ${v.NOME_COMPLETO}` : ''}</span>
              <span style={{ fontWeight:700, color:C.success }}>R$ {Number(v.TOTAL).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Formulário de Fornecedor ─────────────────────────────────────────────────
function FornecedorForm({ item, onSalvo, onCancelar }) {
  const [f, setF] = useState({ nome:'', cnpj:'', endereco:'', telefone:'', email:'', contato_principal:'', devido:'', condicao:'', ...(item ? {
    nome: item.NOME_EMPRESA, cnpj: item.CNPJ||'', endereco: item.ENDERECO||'', telefone: item.TELEFONE||'',
    email: item.EMAIL||'', contato_principal: item.CONTATO_PRINCIPAL||'', devido: item.VALOR_DEVIDO||'', condicao: item.CONDICAO_PAGAMENTO||''
  } : {}) });
  const [erros, setErros] = useState({});
  const [loading, setLoading] = useState(false);

  const v = (nome, val) => setF(p => ({ ...p, [nome]: val }));

  const validar = () => {
    const e = {};
    if (!f.nome.trim()) e.nome = 'Campo obrigatório';
    if (!f.email.trim()) e.email = 'Campo obrigatório';
    if (!f.telefone.trim()) e.telefone = 'Campo obrigatório';
    if (!f.contato_principal.trim()) e.contato_principal = 'Campo obrigatório';
    if (f.cnpj && f.cnpj.replace(/\D/g,'').length !== 14) e.cnpj = 'CNPJ inválido (14 dígitos)';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = async () => {
    if (!validar()) return;
    setLoading(true);
    try {
      const payload = { nome: f.nome, cnpj: f.cnpj, endereco: f.endereco, telefone: f.telefone, email: f.email, contato_principal: f.contato_principal, devido: parseFloat(f.devido)||0, condicao: f.condicao };
      if (item) { await axios.put(`${API}/fornecedores/${item.ID}`, payload); toast.success('Fornecedor atualizado com sucesso!'); }
      else { await axios.post(`${API}/fornecedores`, payload); toast.success('Fornecedor cadastrado com sucesso!'); }
      onSalvo();
    } catch (e) { toast.error(e.response?.data?.erro || 'Erro ao salvar fornecedor'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
      <div style={{ gridColumn:'1/-1' }}>
        <Field label="Nome da Empresa" required error={erros.nome}>
          <input style={inputSt(erros.nome)} value={f.nome} onChange={e => v('nome', e.target.value.toUpperCase())} placeholder="Insira o nome da empresa"/>
        </Field>
      </div>
      <Field label="CNPJ" error={erros.cnpj}>
        <input style={inputSt(erros.cnpj)} value={f.cnpj} onChange={e => v('cnpj', masks.cnpj(e.target.value))} placeholder="00.000.000/0000-00"/>
      </Field>
      <Field label="Telefone" required error={erros.telefone}>
        <input style={inputSt(erros.telefone)} value={f.telefone} onChange={e => v('telefone', masks.tel(e.target.value))} placeholder="(00) 00000-0000"/>
      </Field>
      <Field label="E-mail" required error={erros.email}>
        <input style={inputSt(erros.email)} type="email" value={f.email} onChange={e => v('email', e.target.value)} placeholder="exemplo@fornecedor.com"/>
      </Field>
      <Field label="Contato Principal" required error={erros.contato_principal}>
        <input style={inputSt(erros.contato_principal)} value={f.contato_principal} onChange={e => v('contato_principal', e.target.value)} placeholder="Nome do responsável"/>
      </Field>
      <div style={{ gridColumn:'1/-1' }}>
        <Field label="Endereço" error={erros.endereco}>
          <input style={inputSt()} value={f.endereco} onChange={e => v('endereco', e.target.value)} placeholder="Insira o endereço completo"/>
        </Field>
      </div>
      <Field label="Valor Devido (R$)" error={erros.devido}>
        <input style={inputSt()} type="number" step="0.01" value={f.devido} onChange={e => v('devido', e.target.value)} placeholder="0,00"/>
      </Field>
      <Field label="Condição de Pagamento">
        <input style={inputSt()} value={f.condicao} onChange={e => v('condicao', e.target.value.toUpperCase())} placeholder="Ex: 30/60/90 DDL"/>
      </Field>
      <div style={{ gridColumn:'1/-1', display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
        <Btn onClick={salvar} disabled={loading}>{loading ? 'Salvando...' : item ? 'Atualizar Fornecedor' : 'Cadastrar Fornecedor'}</Btn>
      </div>
    </div>
  );
}

// ─── Página de Fornecedores ───────────────────────────────────────────────────
function Fornecedores() {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/fornecedores`); setRows(r.data); } catch { toast.error('Erro ao carregar fornecedores'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    if (!window.confirm('Confirma a exclusão deste fornecedor?')) return;
    try { await axios.delete(`${API}/fornecedores/${id}`); toast.success('Fornecedor removido!'); load(); }
    catch (e) { toast.error(e.response?.data?.erro || 'Erro ao remover'); }
  };

  const filtered = rows.filter(r => r.NOME_EMPRESA?.includes(search.toUpperCase()) || r.CNPJ?.includes(search));

  const fmtCnpj = v => v ? v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5') : '—';

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <h2 style={titSt}>Fornecedores</h2>
        <Btn onClick={() => { setEditItem(null); setModal(true); }}><Plus size={15}/> Novo Fornecedor</Btn>
      </div>
      <div style={{ position:'relative', marginBottom:16 }}>
        <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:C.muted }}/>
        <input style={{ ...inputSt(), paddingLeft:36 }} placeholder="Pesquisar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>
      <Tabela
        cols={[
          { key:'NOME_EMPRESA', label:'Empresa' },
          { key:'CNPJ', label:'CNPJ', render: v => fmtCnpj(v) },
          { key:'TELEFONE', label:'Telefone' },
          { key:'EMAIL', label:'E-mail' },
          { key:'CONTATO_PRINCIPAL', label:'Contato' },
          { key:'VALOR_DEVIDO', label:'Dívida', render: v => <span style={{ color: v>0 ? C.danger : C.success, fontWeight:700 }}>R$ {Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span> },
        ]}
        rows={filtered}
        onEdit={r => { setEditItem(r); setModal(true); }}
        onDelete={del}
      />
      {modal && (
        <Modal title={editItem ? 'Editar Fornecedor' : 'Cadastro de Fornecedor'} onClose={() => setModal(false)} wide>
          <FornecedorForm item={editItem} onSalvo={() => { setModal(false); load(); }} onCancelar={() => setModal(false)}/>
        </Modal>
      )}
    </div>
  );
}

// ─── Formulário de Produto ────────────────────────────────────────────────────
function ProdutoForm({ item, forns, onSalvo, onCancelar }) {
  const [f, setF] = useState({ nome:'', codigo_barras:'', descricao:'', quantidade:'', preco:'', categoria:'', data_validade:'', fornecedor_id:'', ...(item ? {
    nome: item.NOME_PRODUTO, codigo_barras: item.CODIGO_BARRAS||'', descricao: item.DESCRICAO||'',
    quantidade: item.QUANTIDADE, preco: item.PRECO, categoria: item.CATEGORIA||'', data_validade: item.DATA_VALIDADE||'', fornecedor_id: item.FORNECEDOR_ID||''
  } : {}) });
  const [erros, setErros] = useState({});
  const [loading, setLoading] = useState(false);

  const v = (nome, val) => setF(p => ({ ...p, [nome]: val }));

  const validar = () => {
    const e = {};
    if (!f.nome.trim()) e.nome = 'Campo obrigatório';
    if (!f.descricao.trim()) e.descricao = 'Campo obrigatório';
    if (!f.categoria) e.categoria = 'Selecione uma categoria';
    if (f.quantidade !== '' && isNaN(parseInt(f.quantidade))) e.quantidade = 'Número inválido';
    if (f.preco !== '' && isNaN(parseFloat(f.preco))) e.preco = 'Valor inválido';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = async () => {
    if (!validar()) return;
    setLoading(true);
    try {
      const payload = { nome: f.nome, codigo_barras: f.codigo_barras||undefined, descricao: f.descricao, quantidade: parseInt(f.quantidade)||0, preco: parseFloat(f.preco)||0, categoria: f.categoria, data_validade: f.data_validade||undefined, fornecedor_id: f.fornecedor_id||undefined };
      if (item) { await axios.put(`${API}/produtos/${item.ID}`, payload); toast.success('Produto atualizado com sucesso!'); }
      else { await axios.post(`${API}/produtos`, payload); toast.success('Produto cadastrado com sucesso!'); }
      onSalvo();
    } catch (e) { toast.error(e.response?.data?.erro || 'Erro ao salvar produto'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
      <div style={{ gridColumn:'1/-1' }}>
        <Field label="Nome do Produto" required error={erros.nome}>
          <input style={inputSt(erros.nome)} value={f.nome} onChange={e => v('nome', e.target.value.toUpperCase())} placeholder="Insira o nome do produto"/>
        </Field>
      </div>
      <Field label="Código de Barras" error={erros.codigo_barras}>
        <input style={inputSt()} value={f.codigo_barras} onChange={e => v('codigo_barras', masks.barras(e.target.value))} placeholder="Insira o código de barras"/>
      </Field>
      <Field label="Categoria" required error={erros.categoria}>
        <select style={{ ...inputSt(erros.categoria), backgroundColor:'#fafafa' }} value={f.categoria} onChange={e => v('categoria', e.target.value)}>
          <option value="">Selecione uma categoria</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <div style={{ gridColumn:'1/-1' }}>
        <Field label="Descrição" required error={erros.descricao}>
          <textarea style={{ ...inputSt(erros.descricao), minHeight:72, resize:'vertical' }} value={f.descricao} onChange={e => v('descricao', e.target.value)} placeholder="Descreva brevemente o produto"/>
        </Field>
      </div>
      <Field label="Quantidade em Estoque" error={erros.quantidade}>
        <input style={inputSt(erros.quantidade)} type="number" value={f.quantidade} onChange={e => v('quantidade', e.target.value)} placeholder="0"/>
      </Field>
      <Field label="Preço (R$)" error={erros.preco}>
        <input style={inputSt(erros.preco)} type="number" step="0.01" value={f.preco} onChange={e => v('preco', e.target.value)} placeholder="0,00"/>
      </Field>
      <Field label="Data de Validade" error={erros.data_validade}>
        <input style={inputSt()} type="date" value={f.data_validade} onChange={e => v('data_validade', e.target.value)}/>
      </Field>
      <Field label="Fornecedor Principal">
        <select style={{ ...inputSt(), backgroundColor:'#fafafa' }} value={f.fornecedor_id} onChange={e => v('fornecedor_id', e.target.value)}>
          <option value="">Selecione um fornecedor</option>
          {forns.map(fn => <option key={fn.ID} value={fn.ID}>{fn.NOME_EMPRESA}</option>)}
        </select>
      </Field>
      <div style={{ gridColumn:'1/-1', display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
        <Btn onClick={salvar} disabled={loading}>{loading ? 'Salvando...' : item ? 'Atualizar Produto' : 'Cadastrar Produto'}</Btn>
      </div>
    </div>
  );
}

// ─── Página de Produtos ───────────────────────────────────────────────────────
function Produtos({ forns }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/produtos`, { params: { search } }); setRows(r.data.data); } catch { toast.error('Erro ao carregar produtos'); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    if (!window.confirm('Confirma a exclusão deste produto?')) return;
    try { await axios.delete(`${API}/produtos/${id}`); toast.success('Produto removido!'); load(); }
    catch (e) { toast.error(e.response?.data?.erro || 'Erro ao remover'); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <h2 style={titSt}>Produtos</h2>
        <Btn onClick={() => { setEditItem(null); setModal(true); }}><Plus size={15}/> Novo Produto</Btn>
      </div>
      <div style={{ position:'relative', marginBottom:16 }}>
        <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:C.muted }}/>
        <input style={{ ...inputSt(), paddingLeft:36 }} placeholder="Pesquisar por nome ou código de barras..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>
      <Tabela
        cols={[
          { key:'NOME_PRODUTO', label:'Produto' },
          { key:'CODIGO_BARRAS', label:'Cód. Barras' },
          { key:'CATEGORIA', label:'Categoria', render: v => <span style={{ backgroundColor:'#f0f0f0', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{v}</span> },
          { key:'QUANTIDADE', label:'Estoque', render: v => <span style={{ color: v<=5?C.danger:v<=15?C.warn:C.success, fontWeight:700 }}>{v}</span> },
          { key:'PRECO', label:'Preço', render: v => `R$ ${Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}` },
          { key:'FORNECEDOR_NOME', label:'Fornecedor' },
        ]}
        rows={rows}
        onEdit={r => { setEditItem(r); setModal(true); }}
        onDelete={del}
      />
      {modal && (
        <Modal title={editItem ? 'Editar Produto' : 'Cadastro de Produto'} onClose={() => setModal(false)} wide>
          <ProdutoForm item={editItem} forns={forns} onSalvo={() => { setModal(false); load(); }} onCancelar={() => setModal(false)}/>
        </Modal>
      )}
    </div>
  );
}

// ─── Página de Clientes ───────────────────────────────────────────────────────
function Clientes() {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [lgpdModal, setLgpdModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [consentPending, setConsentPending] = useState(null); // form data aguardando aceite
  const [f, setF] = useState({ nome:'', cpf:'', tel:'', email:'', endereco:'' });
  const [erros, setErros] = useState({});

  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/clientes`); setRows(r.data); } catch { toast.error('Erro ao carregar clientes'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const vf = (nome, val) => setF(p => ({ ...p, [nome]: val }));

  const validar = () => {
    const e = {};
    if (!f.nome.trim()) e.nome = 'Campo obrigatório';
    if (!f.tel.trim()) e.tel = 'Campo obrigatório';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const tentar_salvar = () => {
    if (!validar()) return;
    if (!editItem) { setConsentPending(f); setLgpdModal(true); }
    else salvar(f, true);
  };

  const salvar = async (dados, skip_lgpd = false) => {
    try {
      const payload = { nome: dados.nome, cpf: dados.cpf, tel: dados.tel, email: dados.email, endereco: dados.endereco, consentimento_lgpd: skip_lgpd ? undefined : true };
      if (editItem) { await axios.put(`${API}/clientes/${editItem.ID}`, payload); toast.success('Cliente atualizado!'); }
      else { await axios.post(`${API}/clientes`, payload); toast.success('Cliente cadastrado com sucesso!'); }
      setModal(false); setLgpdModal(false); setConsentPending(null);
      setF({ nome:'', cpf:'', tel:'', email:'', endereco:'' });
      load();
    } catch (e) { toast.error(e.response?.data?.erro || 'Erro ao salvar cliente'); }
  };

  const del = async (id) => {
    if (!window.confirm('Confirma a exclusão deste cliente?')) return;
    try { await axios.delete(`${API}/clientes/${id}`); toast.success('Cliente removido!'); load(); } catch { toast.error('Erro ao remover'); }
  };

  const lgpdEsquecer = async (id) => {
    if (!window.confirm('Esta ação ANONIMIZA permanentemente os dados pessoais conforme Art. 18 da LGPD. Confirma?')) return;
    try { await axios.delete(`${API}/clientes/${id}/lgpd`); toast.success('Dados anonimizados conforme LGPD!'); load(); } catch { toast.error('Erro'); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <h2 style={titSt}>Clientes</h2>
        <Btn onClick={() => { setEditItem(null); setF({ nome:'', cpf:'', tel:'', email:'', endereco:'' }); setModal(true); }}><Plus size={15}/> Novo Cliente</Btn>
      </div>
      <Tabela
        cols={[
          { key:'NOME_COMPLETO', label:'Nome' },
          { key:'TELEFONE', label:'Telefone' },
          { key:'EMAIL', label:'E-mail' },
          { key:'ULTIMA_COMPRA_DATA', label:'Última Compra', render: v => v ? new Date(v).toLocaleDateString('pt-BR') : '—' },
          { key:'ULTIMA_COMPRA_VALOR', label:'Valor', render: v => v>0 ? `R$ ${Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '—' },
        ]}
        rows={rows}
        onEdit={r => { setEditItem(r); setF({ nome:r.NOME_COMPLETO, tel:r.TELEFONE||'', email:r.EMAIL||'', endereco:r.ENDERECO||'' }); setModal(true); }}
        onDelete={del}
        extraActions={r => <UserX size={15} title="Direito ao Esquecimento (LGPD)" onClick={() => lgpdEsquecer(r.ID)} style={{ cursor:'pointer', color:C.warn, marginRight:12 }}/>}
      />

      {modal && (
        <Modal title={editItem ? 'Editar Cliente' : 'Novo Cliente'} onClose={() => setModal(false)}>
          <Field label="Nome Completo" required error={erros.nome}>
            <input style={inputSt(erros.nome)} value={f.nome} onChange={e => vf('nome', e.target.value.toUpperCase())} placeholder="Nome completo do cliente"/>
          </Field>
          <Field label="CPF (opcional — armazenado criptografado)" error={erros.cpf}>
            <input style={inputSt()} value={f.cpf} onChange={e => vf('cpf', masks.cpf(e.target.value))} placeholder="000.000.000-00"/>
          </Field>
          <Field label="Telefone" required error={erros.tel}>
            <input style={inputSt(erros.tel)} value={f.tel} onChange={e => vf('tel', masks.tel(e.target.value))} placeholder="(00) 00000-0000"/>
          </Field>
          <Field label="E-mail">
            <input style={inputSt()} type="email" value={f.email} onChange={e => vf('email', e.target.value)} placeholder="email@cliente.com"/>
          </Field>
          <Field label="Endereço">
            <input style={inputSt()} value={f.endereco} onChange={e => vf('endereco', e.target.value)} placeholder="Endereço completo"/>
          </Field>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={tentar_salvar}>{editItem ? 'Atualizar' : 'Cadastrar'}</Btn>
          </div>
        </Modal>
      )}

      {lgpdModal && (
        <ModalLGPD
          onFechar={() => { setLgpdModal(false); setConsentPending(null); }}
          onAceitar={() => salvar(consentPending)}
        />
      )}
    </div>
  );
}

// ─── Página de Associação ─────────────────────────────────────────────────────
function Associacao({ prods, forns }) {
  const [prodSel, setProdSel] = useState('');
  const [fornSel, setFornSel] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [loading, setLoading] = useState(false);

  const buscarDetalhe = async (id) => {
    if (!id) { setDetalhe(null); return; }
    try { const r = await axios.get(`${API}/produtos/${id}`); setDetalhe(r.data); }
    catch { toast.error('Erro ao buscar detalhes do produto'); }
  };

  useEffect(() => { buscarDetalhe(prodSel); }, [prodSel]);

  const associar = async () => {
    if (!prodSel || !fornSel) return toast.error('Selecione produto e fornecedor');
    setLoading(true);
    try { await axios.post(`${API}/associacao`, { produto_id: prodSel, fornecedor_id: fornSel }); toast.success('Fornecedor associado com sucesso ao produto!'); buscarDetalhe(prodSel); }
    catch (e) { toast.error(e.response?.data?.erro || 'Erro ao associar'); }
    finally { setLoading(false); }
  };

  const desassociar = async (fId) => {
    if (!window.confirm('Confirma a desassociação?')) return;
    try { await axios.delete(`${API}/associacao`, { data: { produto_id: prodSel, fornecedor_id: fId } }); toast.success('Fornecedor desassociado com sucesso!'); buscarDetalhe(prodSel); }
    catch { toast.error('Erro ao desassociar'); }
  };

  return (
    <div>
      <h2 style={titSt}>Associação de Fornecedor a Produto</h2>

      <div style={{ backgroundColor:C.card, borderRadius:10, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:20 }}>
        <h3 style={{ margin:'0 0 16px', fontSize:13, fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:.5 }}>Selecionar Produto</h3>
        <Field label="Produto">
          <select style={{ ...inputSt(), backgroundColor:'#fafafa' }} value={prodSel} onChange={e => setProdSel(e.target.value)}>
            <option value="">Selecione um produto</option>
            {prods.map(p => <option key={p.ID} value={p.ID}>{p.NOME_PRODUTO} — Estoque: {p.QUANTIDADE}</option>)}
          </select>
        </Field>

        {detalhe && (
          <div style={{ backgroundColor:'#f8f8f8', borderRadius:8, padding:'14px 16px', marginTop:12, fontSize:13 }}>
            <p style={{ margin:'0 0 4px', fontWeight:700, color:C.text }}>{detalhe.NOME_PRODUTO}</p>
            {detalhe.CODIGO_BARRAS && <p style={{ margin:'0 0 4px', color:C.muted }}>Cód. Barras: {detalhe.CODIGO_BARRAS}</p>}
            {detalhe.DESCRICAO && <p style={{ margin:0, color:C.muted }}>{detalhe.DESCRICAO}</p>}
          </div>
        )}
      </div>

      {detalhe && (
        <div style={{ backgroundColor:C.card, borderRadius:10, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:20 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:13, fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:.5 }}>Associar Fornecedor</h3>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200 }}>
              <Field label="Selecione um Fornecedor">
                <select style={{ ...inputSt(), backgroundColor:'#fafafa' }} value={fornSel} onChange={e => setFornSel(e.target.value)}>
                  <option value="">Selecione um fornecedor</option>
                  {forns.map(f => <option key={f.ID} value={f.ID}>{f.NOME_EMPRESA}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ paddingTop:22 }}>
              <Btn onClick={associar} disabled={loading}><Link2 size={15}/> Associar Fornecedor</Btn>
            </div>
          </div>
        </div>
      )}

      {detalhe?.fornecedores_associados?.length > 0 && (
        <div style={{ backgroundColor:C.card, borderRadius:10, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:13, fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:.5 }}>Fornecedores Associados a este Produto</h3>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ borderBottom:`2px solid ${C.border}` }}>
              <th style={{ padding:'8px 12px', textAlign:'left', color:C.muted, fontSize:11, textTransform:'uppercase' }}>Nome</th>
              <th style={{ padding:'8px 12px', textAlign:'left', color:C.muted, fontSize:11, textTransform:'uppercase' }}>CNPJ</th>
              <th style={{ padding:'8px 12px' }}></th>
            </tr></thead>
            <tbody>{detalhe.fornecedores_associados.map(f => (
              <tr key={f.ID} style={{ borderBottom:`1px solid ${C.border}` }}>
                <td style={{ padding:'10px 12px' }}>{f.NOME_EMPRESA}</td>
                <td style={{ padding:'10px 12px', color:C.muted }}>{f.CNPJ ? f.CNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5') : '—'}</td>
                <td style={{ padding:'10px 12px' }}><Btn variant="danger" small onClick={() => desassociar(f.ID)}>Desassociar</Btn></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PDV / Orçamento ──────────────────────────────────────────────────────────
function PDV({ prods, clis }) {
  const [itens, setItens] = useState([{ prod_id:'', qtd:1 }]);
  const [cli_id, setCli] = useState('');
  const [loading, setLoading] = useState(false);

  const addItem = () => setItens(p => [...p, { prod_id:'', qtd:1 }]);
  const remItem = i => setItens(p => p.filter((_,idx) => idx !== i));
  const setItem = (i, campo, val) => setItens(p => p.map((it,idx) => idx===i ? {...it,[campo]:val} : it));

  const getProd = id => prods.find(p => String(p.ID) === String(id));
  const total = itens.reduce((s,it) => s + (getProd(it.prod_id)?.PRECO||0) * (parseInt(it.qtd)||0), 0);

  const registrar = async () => {
    const validos = itens.filter(it => it.prod_id && it.qtd > 0);
    if (!validos.length) return toast.error('Adicione ao menos um produto');
    setLoading(true);
    try {
      for (const it of validos) await axios.post(`${API}/vendas`, { cliente_id: cli_id||undefined, produto_id: it.prod_id, quantidade: it.qtd });
      toast.success('Venda registrada com sucesso!');
      setItens([{ prod_id:'', qtd:1 }]); setCli('');
    } catch (e) { toast.error(e.response?.data?.erro || 'Erro ao registrar venda'); }
    finally { setLoading(false); }
  };

  const gerarPDF = () => {
    const validos = itens.filter(it => it.prod_id && it.qtd > 0);
    if (!validos.length) return toast.error('Adicione ao menos um produto');
    const cli = clis.find(c => String(c.ID) === String(cli_id));
    const doc = new jsPDF();

    // Cabeçalho
    doc.setFillColor(17, 17, 17);
    doc.rect(0, 0, 210, 50, 'F');
    try { doc.addImage(logoImg, 'JPEG', 14, 8, 32, 32); } catch {}
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica','bold');
    doc.text('OLD SCHOOL GARAGE', 52, 22);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('MANUTENÇÃO · PERFORMANCE · CUSTOMIZAÇÃO', 52, 30);
    doc.setTextColor(255, 77, 0);
    doc.setFontSize(22); doc.setFont('helvetica','bold');
    doc.text('ORÇAMENTO', 52, 44);

    // Info
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Cliente: ${cli?.NOME_COMPLETO || 'Consumidor Final'}`, 14, 64);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 150, 64);
    doc.text(`Nº: ${Date.now().toString().slice(-6)}`, 150, 70);

    // Tabela
    autoTable(doc, {
      startY: 76,
      head: [['ITEM / DESCRIÇÃO', 'QTD', 'UNIT (R$)', 'TOTAL (R$)']],
      body: validos.map(it => {
        const p = getProd(it.prod_id);
        return [p?.NOME_PRODUTO || '—', it.qtd, Number(p?.PRECO||0).toLocaleString('pt-BR',{minimumFractionDigits:2}), Number((p?.PRECO||0)*it.qtd).toLocaleString('pt-BR',{minimumFractionDigits:2})];
      }),
      headStyles: { fillColor:[255,77,0], textColor:255, fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:10 },
      alternateRowStyles: { fillColor:[248,248,248] },
      theme: 'grid',
    });

    const y = doc.lastAutoTable.finalY + 12;
    doc.setFillColor(255,77,0);
    doc.rect(130, y, 66, 14, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(`TOTAL: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, 134, y+9);

    doc.setTextColor(150);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text('Orçamento válido por 15 dias. Preços sujeitos a alteração.', 14, y+20);

    doc.save(`OSG_Orcamento_${cli?.NOME_COMPLETO?.replace(/ /g,'_') || 'Sem_Cliente'}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div>
      <h2 style={titSt}>PDV — Ponto de Venda / Orçamento</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20, alignItems:'start' }}>
        <div style={{ backgroundColor:C.card, borderRadius:10, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <Field label="Cliente (opcional)">
            <select style={{ ...inputSt(), backgroundColor:'#fafafa' }} value={cli_id} onChange={e => setCli(e.target.value)}>
              <option value="">Consumidor Final</option>
              {clis.map(c => <option key={c.ID} value={c.ID}>{c.NOME_COMPLETO}</option>)}
            </select>
          </Field>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'16px 0 12px' }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase' }}>Itens</span>
            <Btn small onClick={addItem}><Plus size={13}/> Adicionar Item</Btn>
          </div>
          {itens.map((it, i) => {
            const p = getProd(it.prod_id);
            return (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                <select style={{ ...inputSt(), flex:2 }} value={it.prod_id} onChange={e => setItem(i,'prod_id',e.target.value)}>
                  <option value="">Selecione...</option>
                  {prods.map(pr => <option key={pr.ID} value={pr.ID}>{pr.NOME_PRODUTO} — R$ {Number(pr.PRECO).toFixed(2)}</option>)}
                </select>
                <input style={{ ...inputSt(), width:64 }} type="number" min="1" value={it.qtd} onChange={e => setItem(i,'qtd',parseInt(e.target.value)||1)}/>
                {p && <span style={{ fontSize:12, fontWeight:700, color:C.success, whiteSpace:'nowrap' }}>R$ {(p.PRECO*it.qtd).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                {itens.length > 1 && <Minus size={16} onClick={() => remItem(i)} style={{ cursor:'pointer', color:C.danger, flexShrink:0 }}/>}
              </div>
            );
          })}
        </div>

        <div style={{ backgroundColor:C.dark, borderRadius:10, padding:24, color:'#fff', position:'sticky', top:20 }}>
          <p style={{ margin:'0 0 20px', fontSize:12, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:.5 }}>Resumo</p>
          {itens.filter(it=>it.prod_id).map((it,i) => {
            const p = getProd(it.prod_id);
            return p ? (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
                <span style={{ color:'#ccc' }}>{p.NOME_PRODUTO} x{it.qtd}</span>
                <span style={{ fontWeight:700 }}>R$ {(p.PRECO*it.qtd).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
              </div>
            ) : null;
          })}
          <div style={{ borderTop:'1px solid #333', paddingTop:16, marginTop:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:700, textTransform:'uppercase', fontSize:13 }}>Total</span>
            <span style={{ fontSize:24, fontWeight:900, color:C.accent }}>R$ {total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:20 }}>
            <Btn onClick={registrar} disabled={loading}><CheckCircle size={15}/> {loading?'Registrando...':'Registrar Venda'}</Btn>
            <Btn variant="ghost" onClick={gerarPDF} style={{ borderColor:'#444', color:'#fff' }}><FileText size={15}/> Gerar PDF / Orçamento</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Estilos globais ──────────────────────────────────────────────────────────
const titSt = { margin:'0 0 4px', fontSize:20, fontWeight:900, color:C.text, textTransform:'uppercase', letterSpacing:-.5 };

// ─── App Principal ────────────────────────────────────────────────────────────
export default function App() {
  const [aba, setAba] = useState('dashboard');
  const [prods, setProds] = useState([]);
  const [clis, setClis] = useState([]);
  const [forns, setForns] = useState([]);

  const loadGlobal = useCallback(async () => {
    try {
      const [p, c, f] = await Promise.all([
        axios.get(`${API}/produtos`), axios.get(`${API}/clientes`), axios.get(`${API}/fornecedores`)
      ]);
      setProds(p.data.data || []); setClis(c.data || []); setForns(f.data || []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadGlobal(); }, [loadGlobal, aba]);

  const NavBtn = ({ id, Icon, label }) => (
    <button onClick={() => setAba(id)} style={{
      display:'flex', alignItems:'center', gap:10, width:'100%', padding:'11px 14px',
      border:'none', borderRadius:8, marginBottom:4, cursor:'pointer', fontFamily:'inherit',
      backgroundColor: aba===id ? C.accent : 'transparent',
      color: aba===id ? '#fff' : C.muted, fontWeight:700, fontSize:12,
      textTransform:'uppercase', letterSpacing:.5, transition:'all .2s',
    }}>
      <Icon size={16}/> {label}
      {aba===id && <ChevronRight size={14} style={{ marginLeft:'auto' }}/>}
    </button>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh', backgroundColor:C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: ${C.accent} !important; box-shadow: 0 0 0 3px rgba(255,77,0,0.1); }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:#f0f0f0; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width:240, backgroundColor:C.card, padding:'24px 16px', borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
        <div style={{ textAlign:'center', marginBottom:28, paddingBottom:20, borderBottom:`1px solid ${C.border}` }}>
          <img src={logoImg} alt="Old School Garage" style={{ width:80, height:80, objectFit:'contain', borderRadius:'50%', border:`3px solid ${C.accent}` }}/>
          <p style={{ margin:'10px 0 0', fontSize:11, fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:1 }}>Old School Garage</p>
        </div>
        <NavBtn id="dashboard" Icon={LayoutDashboard} label="Dashboard"/>
        <NavBtn id="produtos"  Icon={Package}          label="Produtos"/>
        <NavBtn id="forns"     Icon={Truck}            label="Fornecedores"/>
        <NavBtn id="assoc"     Icon={Link2}            label="Associações"/>
        <NavBtn id="clientes"  Icon={Users}            label="Clientes"/>
        <NavBtn id="pdv"       Icon={ShoppingCart}     label="PDV / Orçamento"/>
        <div style={{ marginTop:'auto', paddingTop:20, borderTop:`1px solid ${C.border}`, fontSize:10, color:C.muted, textAlign:'center', lineHeight:1.6 }}>
          <Shield size={12} style={{ marginBottom:4 }}/><br/>
          Dados protegidos<br/>
          conforme <strong>LGPD</strong><br/>
          Lei nº 13.709/2018
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, padding:28, overflowX:'hidden' }}>
        {aba === 'dashboard' && <Dashboard/>}
        {aba === 'produtos'  && <Produtos  forns={forns}/>}
        {aba === 'forns'     && <Fornecedores/>}
        {aba === 'assoc'     && <Associacao prods={prods} forns={forns}/>}
        {aba === 'clientes'  && <Clientes/>}
        {aba === 'pdv'       && <PDV prods={prods} clis={clis}/>}
      </main>

      <Toast/>
    </div>
  );
}