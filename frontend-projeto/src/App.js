import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    LayoutDashboard, Package, Users, Truck, Link2, ShoppingCart,
    Edit3, Trash2, CheckCircle, Info, AlertTriangle, Search, Shield,
    X, Plus, Minus, FileText, UserX, ArrowDownCircle, TrendingDown,
    TrendingUp, Clock, XCircle, Tag, LogOut, LogIn, UserPlus, Eye, EyeOff
} from 'lucide-react';
import logoImg from './logo_garage.png';

const API = 'http://localhost:3000';
const CATEGORIAS = ['PEÇAS','ACESSÓRIOS','ELÉTRICA','SUSPENSÃO','MOTOR','FREIOS','FUNILARIA','PINTURA','FLUIDOS','FERRAMENTAS','OUTRO'];
const FORMAS_PAG = ['DINHEIRO','PIX','CARTÃO DE CRÉDITO','CARTÃO DE DÉBITO','BOLETO','TRANSFERÊNCIA','FIADO'];
const FORMAS_DESCONTO = ['DINHEIRO','PIX'];
const TAXA_DESCONTO = 0.10;

const C = {
    accent:'#ff4d00', dark:'#111111', card:'#ffffff',
    bg:'#f0f0f0', border:'#e0e0e0', text:'#1a1a1a',
    muted:'#888888', success:'#16a34a', danger:'#dc2626', warn:'#d97706',
};

const masks = {
    cnpj:   v => v.replace(/\D/g,'').slice(0,14).replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d)/,'$1-$2'),
    cpf:    v => v.replace(/\D/g,'').slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1-$2'),
    tel:    v => { const n=v.replace(/\D/g,'').slice(0,11); return n.length>10?n.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'):n.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3'); },
    barras: v => v.replace(/\D/g,'').slice(0,13),
};

const fmt = {
    brl:  v => Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2}),
    data: v => v ? new Date(v).toLocaleDateString('pt-BR') : '—',
};

const clean = v => typeof v === 'string' ? v.replace(/[<>"'`]/g,'') : v;
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

const getToken = () => localStorage.getItem('osg_token');
const getUsuario = () => { try { return JSON.parse(localStorage.getItem('osg_usuario')); } catch { return null; } };

axios.interceptors.request.use(cfg => {
    const t = getToken();
    if (t) cfg.headers['Authorization'] = `Bearer ${t}`;
    return cfg;
});
axios.interceptors.response.use(r => r, e => {
    if (e.response?.status === 401) {
        localStorage.removeItem('osg_token');
        localStorage.removeItem('osg_usuario');
        window.location.reload();
    }
    return Promise.reject(e);
});

let _setToast = () => {};
const toast = {
    success: m => _setToast({ msg:m, type:'success' }),
    error:   m => _setToast({ msg:m, type:'error' }),
    info:    m => _setToast({ msg:m, type:'info' }),
};

function Toast() {
    const [t, setT] = useState(null);
    useEffect(() => { _setToast = setT; }, []);
    useEffect(() => { if (t) { const id=setTimeout(()=>setT(null),4500); return ()=>clearTimeout(id); } }, [t]);
    if (!t) return null;
    const cfg = { success:{bg:C.success,Icon:CheckCircle}, error:{bg:C.danger,Icon:XCircle}, info:{bg:'#1d4ed8',Icon:Info} }[t.type];
    return (
        <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,display:'flex',alignItems:'center',gap:10,
            backgroundColor:cfg.bg,color:'#fff',padding:'14px 20px',borderRadius:10,
            boxShadow:'0 8px 30px rgba(0,0,0,0.25)',maxWidth:420,fontWeight:600,fontSize:14}}>
            <cfg.Icon size={18}/>{t.msg}
        </div>
    );
}

const iSt = (err) => ({
    width:'100%', padding:'10px 12px', border:`1.5px solid ${err?C.danger:C.border}`,
    borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit',
    boxSizing:'border-box', backgroundColor:'#fafafa',
});

const iStAuth = (err) => ({
    width:'100%', padding:'11px 12px 11px 40px', border:`1.5px solid ${err?C.danger:C.border}`,
    borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit',
    boxSizing:'border-box', backgroundColor:'#1e1e1e', color:'#fff',
});

function Field({ label, error, children, required }) {
    return (
        <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:error?C.danger:C.muted,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>
                {label}{required&&<span style={{color:C.accent}}> *</span>}
            </label>
            {children}
            {error&&<p style={{margin:'4px 0 0',fontSize:11,color:C.danger}}>{error}</p>}
        </div>
    );
}

function Btn({ children, onClick, variant='primary', small, disabled }) {
    const cfg = {
        primary: {bg:C.accent,  cl:'#fff', bd:'none'},
        dark:    {bg:C.dark,    cl:'#fff', bd:'none'},
        ghost:   {bg:'transparent', cl:C.text, bd:`1.5px solid ${C.border}`},
        danger:  {bg:C.danger,  cl:'#fff', bd:'none'},
        success: {bg:C.success, cl:'#fff', bd:'none'},
    }[variant] || {bg:C.accent, cl:'#fff', bd:'none'};
    return (
        <button onClick={onClick} disabled={disabled} style={{
            padding:small?'7px 14px':'11px 20px', backgroundColor:disabled?C.border:cfg.bg,
            color:disabled?C.muted:cfg.cl, border:cfg.bd, borderRadius:7, fontWeight:700,
            fontSize:small?12:13, cursor:disabled?'not-allowed':'pointer', display:'inline-flex',
            alignItems:'center', gap:6, textTransform:'uppercase', letterSpacing:.5, fontFamily:'inherit',
        }}>{children}</button>
    );
}

function Modal({ title, onClose, children, wide }) {
    return (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{backgroundColor:C.card,borderRadius:12,width:'100%',maxWidth:wide?740:500,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.35)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:`1px solid ${C.border}`}}>
                    <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.text,textTransform:'uppercase',letterSpacing:1}}>{title}</h3>
                    <X size={20} style={{cursor:'pointer',color:C.muted}} onClick={onClose}/>
                </div>
                <div style={{padding:24}}>{children}</div>
            </div>
        </div>
    );
}

function Tabela({ cols, rows, onEdit, onDelete, extraActions }) {
    return (
        <div style={{overflowX:'auto',marginTop:20}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                    <tr style={{backgroundColor:'#f8f8f8',borderBottom:`2px solid ${C.border}`}}>
                        {cols.map(c=><th key={c.key} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5,whiteSpace:'nowrap'}}>{c.label}</th>)}
                        <th style={{padding:'10px 12px'}}>AÇÕES</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length===0&&<tr><td colSpan={cols.length+1} style={{textAlign:'center',padding:32,color:C.muted}}>Nenhum registro encontrado.</td></tr>}
                    {rows.map((row,i)=>(
                        <tr key={row.ID||i} style={{borderBottom:`1px solid ${C.border}`}}
                            onMouseEnter={e=>e.currentTarget.style.backgroundColor='#fafafa'}
                            onMouseLeave={e=>e.currentTarget.style.backgroundColor='transparent'}>
                            {cols.map(c=>(
                                <td key={c.key} style={{padding:'10px 12px',color:C.text,verticalAlign:'middle'}}>
                                    {c.render?c.render(row[c.key],row):(row[c.key]??'—')}
                                </td>
                            ))}
                            <td style={{padding:'10px 12px',whiteSpace:'nowrap'}}>
                                {onEdit&&<Edit3 size={15} onClick={()=>onEdit(row)} style={{cursor:'pointer',color:C.accent,marginRight:12}}/>}
                                {extraActions&&extraActions(row)}
                                {onDelete&&<Trash2 size={15} onClick={()=>onDelete(row.ID)} style={{cursor:'pointer',color:C.danger}}/>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ModalLGPD({ onAceitar, onFechar }) {
    return (
        <Modal title="Política de Privacidade — LGPD" onClose={onFechar} wide>
            <div style={{fontSize:13,lineHeight:1.7,color:C.text}}>
                <div style={{display:'flex',gap:10,backgroundColor:'#fff7ed',border:`1px solid #fed7aa`,borderRadius:8,padding:'12px 16px',marginBottom:16}}>
                    <Shield size={18} style={{color:C.warn,flexShrink:0,marginTop:2}}/>
                    <p style={{margin:0,fontSize:12}}>Em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</strong>, informamos como seus dados pessoais serão tratados.</p>
                </div>
                <h4 style={{margin:'0 0 6px'}}>1. Dados coletados</h4>
                <p style={{margin:'0 0 12px',color:C.muted}}>Nome, CPF (armazenado de forma criptografada com AES), telefone, e-mail e endereço, utilizados exclusivamente para gestão de vendas e relacionamento comercial.</p>
                <h4 style={{margin:'0 0 6px'}}>2. Base legal (Art. 7º, I)</h4>
                <p style={{margin:'0 0 12px',color:C.muted}}>O tratamento é realizado com base no <strong>consentimento explícito do titular</strong> para execução do contrato de prestação de serviços.</p>
                <h4 style={{margin:'0 0 6px'}}>3. Seus direitos (Art. 18)</h4>
                <p style={{margin:'0 0 12px',color:C.muted}}>Você pode solicitar acesso, correção, portabilidade ou exclusão permanente dos seus dados a qualquer momento diretamente neste sistema.</p>
                <h4 style={{margin:'0 0 6px'}}>4. Segurança e compartilhamento</h4>
                <p style={{margin:'0 0 20px',color:C.muted}}>Os dados são armazenados localmente com criptografia AES. Nenhum dado é compartilhado com terceiros.</p>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                    <Btn variant="ghost" onClick={onFechar}>Recusar</Btn>
                    <Btn onClick={onAceitar}><CheckCircle size={15}/>Aceitar e Continuar</Btn>
                </div>
            </div>
        </Modal>
    );
}

function TelaAuth() {
    const { login } = useAuth();
    const [modo, setModo] = useState('login');
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [confirmar, setConfirmar] = useState('');
    const [erros, setErros] = useState({});
    const [loading, setLoading] = useState(false);
    const [verSenha, setVerSenha] = useState(false);

    const trocarModo = (m) => { setModo(m); setErros({}); };

    const validar = () => {
        const e = {};
        if (modo==='register' && nome.trim().length < 2) e.nome='Nome deve ter ao menos 2 caracteres';
        if (!email || !emailOk(email)) e.email='E-mail inválido';
        if (!senha || senha.length < 6) e.senha='Mínimo 6 caracteres';
        if (modo==='register' && senha !== confirmar) e.confirmar='As senhas não coincidem';
        setErros(e);
        return !Object.keys(e).length;
    };

    const enviar = async () => {
        if (!validar()) return;
        setLoading(true);
        try {
            if (modo==='register') {
                await axios.post(`${API}/auth/register`, { nome:clean(nome), email:email.toLowerCase(), senha });
                toast.success('Conta criada com sucesso! Faça login para continuar.');
                trocarModo('login');
            } else {
                const r = await axios.post(`${API}/auth/login`, { email:email.toLowerCase(), senha });
                login(r.data.token, { nome:r.data.nome, email:r.data.email });
            }
        } catch(e) {
            toast.error(e.response?.data?.erro || 'Erro ao processar requisição');
        } finally { setLoading(false); }
    };

    const iconSt = { position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#555', pointerEvents:'none' };

    return (
        <div style={{minHeight:'100vh',backgroundColor:'#111',display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
            <style>{`
                *{box-sizing:border-box;}
                input:-webkit-autofill{-webkit-box-shadow:0 0 0 30px #1e1e1e inset!important;-webkit-text-fill-color:#fff!important;}
                input:focus{border-color:${C.accent}!important;outline:none;box-shadow:0 0 0 3px rgba(255,77,0,0.2);}
            `}</style>
            <div style={{width:'100%',maxWidth:420}}>
                <div style={{textAlign:'center',marginBottom:32}}>
                    <div style={{width:90,height:90,borderRadius:'50%',border:`3px solid ${C.accent}`,overflow:'hidden',margin:'0 auto 16px',backgroundColor:'#222',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <img src={logoImg} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                    </div>
                    <h1 style={{margin:0,fontSize:22,fontWeight:900,color:'#fff',letterSpacing:1,textTransform:'uppercase'}}>Old School Garage</h1>
                    <p style={{margin:'6px 0 0',fontSize:12,color:'#666',textTransform:'uppercase',letterSpacing:1}}>Sistema de Gestão</p>
                </div>

                <div style={{backgroundColor:'#1a1a1a',borderRadius:14,padding:32,boxShadow:'0 20px 60px rgba(0,0,0,0.5)',border:'1px solid #2a2a2a'}}>
                    <div style={{display:'flex',backgroundColor:'#111',borderRadius:8,padding:4,marginBottom:28}}>
                        {[['login','Entrar',LogIn],['register','Criar Conta',UserPlus]].map(([id,label,Icon])=>(
                            <button key={id} onClick={()=>trocarModo(id)} style={{flex:1,padding:'9px',border:'none',borderRadius:6,cursor:'pointer',backgroundColor:modo===id?C.accent:'transparent',color:modo===id?'#fff':'#666',fontWeight:700,fontSize:12,textTransform:'uppercase',letterSpacing:.5,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'all .2s'}}>
                                <Icon size={13}/>{label}
                            </button>
                        ))}
                    </div>

                    {modo==='register' && (
                        <div style={{marginBottom:18}}>
                            <label style={{display:'block',fontSize:11,fontWeight:700,color:erros.nome?C.danger:'#666',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>
                                Nome completo <span style={{color:C.accent}}>*</span>
                            </label>
                            <div style={{position:'relative'}}>
                                <Users size={16} style={iconSt}/>
                                <input
                                    style={iStAuth(erros.nome)}
                                    value={nome}
                                    onChange={e=>setNome(e.target.value)}
                                    placeholder="Seu nome completo"
                                    autoComplete="name"
                                />
                            </div>
                            {erros.nome&&<p style={{margin:'4px 0 0',fontSize:11,color:C.danger}}>{erros.nome}</p>}
                        </div>
                    )}

                    <div style={{marginBottom:18}}>
                        <label style={{display:'block',fontSize:11,fontWeight:700,color:erros.email?C.danger:'#666',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>
                            E-mail <span style={{color:C.accent}}>*</span>
                        </label>
                        <div style={{position:'relative'}}>
                            <Users size={16} style={iconSt}/>
                            <input
                                style={iStAuth(erros.email)}
                                type="email"
                                value={email}
                                onChange={e=>setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                autoComplete="email"
                            />
                        </div>
                        {erros.email&&<p style={{margin:'4px 0 0',fontSize:11,color:C.danger}}>{erros.email}</p>}
                    </div>

                    <div style={{marginBottom:modo==='register'?18:28}}>
                        <label style={{display:'block',fontSize:11,fontWeight:700,color:erros.senha?C.danger:'#666',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>
                            Senha <span style={{color:C.accent}}>*</span>
                        </label>
                        <div style={{position:'relative'}}>
                            <Shield size={16} style={iconSt}/>
                            <input
                                style={{...iStAuth(erros.senha),paddingRight:42}}
                                type={verSenha?'text':'password'}
                                value={senha}
                                onChange={e=>setSenha(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                autoComplete={modo==='login'?'current-password':'new-password'}
                            />
                            <button onClick={()=>setVerSenha(p=>!p)} type="button" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#666',padding:0,display:'flex',alignItems:'center'}}>
                                {verSenha?<EyeOff size={16}/>:<Eye size={16}/>}
                            </button>
                        </div>
                        {erros.senha&&<p style={{margin:'4px 0 0',fontSize:11,color:C.danger}}>{erros.senha}</p>}
                    </div>

                    {modo==='register' && (
                        <div style={{marginBottom:28}}>
                            <label style={{display:'block',fontSize:11,fontWeight:700,color:erros.confirmar?C.danger:'#666',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>
                                Confirmar Senha <span style={{color:C.accent}}>*</span>
                            </label>
                            <div style={{position:'relative'}}>
                                <Shield size={16} style={iconSt}/>
                                <input
                                    style={iStAuth(erros.confirmar)}
                                    type="password"
                                    value={confirmar}
                                    onChange={e=>setConfirmar(e.target.value)}
                                    placeholder="Repita a senha"
                                    autoComplete="new-password"
                                />
                            </div>
                            {erros.confirmar&&<p style={{margin:'4px 0 0',fontSize:11,color:C.danger}}>{erros.confirmar}</p>}
                        </div>
                    )}

                    <button onClick={enviar} disabled={loading} style={{width:'100%',padding:'14px',backgroundColor:loading?'#555':C.accent,color:'#fff',border:'none',borderRadius:8,fontWeight:800,fontSize:14,cursor:loading?'not-allowed':'pointer',textTransform:'uppercase',letterSpacing:1,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all .2s'}}>
                        {loading?'Aguarde...':(modo==='login'?<><LogIn size={16}/>Entrar</>:<><UserPlus size={16}/>Criar Conta</>)}
                    </button>

                    <p style={{textAlign:'center',marginTop:20,fontSize:13,color:'#555'}}>
                        {modo==='login'?'Não tem conta? ':'Já tem conta? '}
                        <span onClick={()=>trocarModo(modo==='login'?'register':'login')} style={{color:C.accent,cursor:'pointer',fontWeight:700}}>
                            {modo==='login'?'Criar conta gratuita':'Fazer login'}
                        </span>
                    </p>
                </div>

                <div style={{textAlign:'center',marginTop:20,fontSize:11,color:'#444',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <Shield size={11}/> Dados protegidos conforme LGPD — Lei nº 13.709/2018
                </div>
            </div>
            <Toast/>
        </div>
    );
}

function Dashboard() {
    const [stats, setStats] = useState(null);
    const load = useCallback(async () => {
        try { const r=await axios.get(`${API}/dashboard`); setStats(r.data); }
        catch { toast.error('Erro ao carregar painel'); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const pagarEntrada = async (id) => {
        try { await axios.patch(`${API}/entradas/${id}/pagar`); toast.success('Pagamento ao fornecedor registrado!'); load(); }
        catch(e) { toast.error(e.response?.data?.erro||'Erro'); }
    };
    const receberVenda = async (id) => {
        try { await axios.patch(`${API}/vendas/${id}/pagar`); toast.success('Recebimento registrado!'); load(); }
        catch(e) { toast.error(e.response?.data?.erro||'Erro'); }
    };

    if (!stats) return <div style={{padding:40,textAlign:'center',color:C.muted}}>Carregando...</div>;
    const vencido = d => d && new Date(d) < new Date();

    const KPI = ({ label, value, sub, color, Icon }) => (
        <div style={{backgroundColor:C.card,borderRadius:10,padding:'18px 22px',borderLeft:`4px solid ${color}`,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                {Icon&&<Icon size={15} style={{color}}/>}
                <p style={{margin:0,fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>{label}</p>
            </div>
            <p style={{margin:'0 0 4px',fontSize:26,fontWeight:900,color:C.text}}>{value}</p>
            {sub&&<p style={{margin:0,fontSize:11,color:C.muted}}>{sub}</p>}
        </div>
    );

    return (
        <div>
            <h2 style={titSt}>Painel</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:14,marginBottom:24}}>
                <KPI label="Produtos Cadastrados"  value={stats.total_produtos}     color={C.accent}  Icon={Package}/>
                <KPI label="Fornecedores Ativos"   value={stats.total_fornecedores} color="#7c3aed"   Icon={Truck}/>
                <KPI label="Clientes Cadastrados"  value={stats.total_clientes}     color="#0891b2"   Icon={Users}/>
                <KPI label="Total em Vendas"        value={`R$ ${fmt.brl(stats.total_vendas)}`}   sub={`${stats.qtd_vendas} transações`} color={C.success} Icon={TrendingUp}/>
                <KPI label="A Pagar Fornecedores"  value={`R$ ${fmt.brl(stats.total_a_pagar)}`}  sub="Saldo devedor total"  color={C.danger} Icon={TrendingDown}/>
                <KPI label="A Receber Clientes"     value={`R$ ${fmt.brl(stats.total_a_receber)}`} sub="Vendas em aberto"  color={C.warn}   Icon={Clock}/>
            </div>

            {stats.estoque_baixo?.length>0&&(
                <div style={{backgroundColor:'#fff7ed',border:`1px solid #fed7aa`,borderRadius:10,padding:'14px 18px',marginBottom:20}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <AlertTriangle size={16} style={{color:C.warn}}/>
                        <span style={{fontWeight:800,color:C.warn,textTransform:'uppercase',fontSize:12}}>Alerta: Estoque Baixo</span>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                        {stats.estoque_baixo.map(p=>(
                            <span key={p.ID} style={{backgroundColor:'#fed7aa',color:'#9a3412',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700}}>
                                {p.NOME_PRODUTO} — {p.QUANTIDADE} un.
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
                <div style={{backgroundColor:C.card,borderRadius:10,padding:'20px 22px',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
                    <h3 style={{margin:'0 0 14px',fontSize:12,fontWeight:800,color:C.danger,textTransform:'uppercase',letterSpacing:.5,display:'flex',alignItems:'center',gap:6}}>
                        <TrendingDown size={14}/>Contas a Pagar — Fornecedores
                    </h3>
                    {!stats.contas_a_pagar?.length&&<p style={{fontSize:12,color:C.muted,margin:0}}>Nenhuma conta em aberto.</p>}
                    {stats.contas_a_pagar?.map(e=>(
                        <div key={e.ID} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`,gap:8}}>
                            <div style={{fontSize:12,minWidth:0}}>
                                <p style={{margin:0,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.NOME_PRODUTO}</p>
                                <p style={{margin:'2px 0 0',color:C.muted,fontSize:11}}>{e.NOME_EMPRESA} · Venc: <span style={{color:vencido(e.DATA_VENCIMENTO)?C.danger:C.text}}>{fmt.data(e.DATA_VENCIMENTO)}</span></p>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                                <span style={{fontWeight:700,color:C.danger,fontSize:12}}>R$ {fmt.brl(e.TOTAL)}</span>
                                <Btn small variant="success" onClick={()=>pagarEntrada(e.ID)}><CheckCircle size={12}/>Pagar</Btn>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{backgroundColor:C.card,borderRadius:10,padding:'20px 22px',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
                    <h3 style={{margin:'0 0 14px',fontSize:12,fontWeight:800,color:C.success,textTransform:'uppercase',letterSpacing:.5,display:'flex',alignItems:'center',gap:6}}>
                        <TrendingUp size={14}/>Contas a Receber — Clientes
                    </h3>
                    {!stats.contas_a_receber?.length&&<p style={{fontSize:12,color:C.muted,margin:0}}>Nenhuma conta em aberto.</p>}
                    {stats.contas_a_receber?.map(v=>(
                        <div key={v.ID} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`,gap:8}}>
                            <div style={{fontSize:12,minWidth:0}}>
                                <p style={{margin:0,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.NOME_PRODUTO}</p>
                                <p style={{margin:'2px 0 0',color:C.muted,fontSize:11}}>{v.NOME_COMPLETO||'Consumidor final'} · Venc: <span style={{color:vencido(v.DATA_VENCIMENTO)?C.danger:C.text}}>{fmt.data(v.DATA_VENCIMENTO)}</span></p>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                                <span style={{fontWeight:700,color:C.success,fontSize:12}}>R$ {fmt.brl(v.TOTAL)}</span>
                                <Btn small variant="success" onClick={()=>receberVenda(v.ID)}><CheckCircle size={12}/>Receber</Btn>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {stats.vendas_recentes?.length>0&&(
                <div style={{backgroundColor:C.card,borderRadius:10,padding:'20px 22px',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
                    <h3 style={{margin:'0 0 14px',fontSize:12,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Últimas Vendas</h3>
                    {stats.vendas_recentes.map((v,i)=>(
                        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:`1px solid ${C.border}`,fontSize:13}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                                <span style={{fontWeight:700}}>{v.NOME_PRODUTO}</span>
                                {v.NOME_COMPLETO&&<span style={{color:C.muted}}>— {v.NOME_COMPLETO}</span>}
                                <span style={{fontSize:11,backgroundColor:v.PAGO?'#dcfce7':'#fef3c7',color:v.PAGO?C.success:C.warn,padding:'1px 7px',borderRadius:20,fontWeight:700}}>
                                    {v.PAGO?'PAGO':v.FORMA_PAGAMENTO}
                                </span>
                                {v.DESCONTO_PERCENTUAL>0&&<span style={{fontSize:11,backgroundColor:'#f0fdf4',color:C.success,padding:'1px 7px',borderRadius:20,fontWeight:700}}><Tag size={10}/> {v.DESCONTO_PERCENTUAL}% OFF</span>}
                            </div>
                            <span style={{fontWeight:700,color:C.success,flexShrink:0}}>R$ {fmt.brl(v.TOTAL)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function EntradaModal({ prods, forns, onSalvo, onFechar }) {
    const [f, setF] = useState({produto_id:'',fornecedor_id:'',quantidade:'',preco_unitario:'',data_vencimento:''});
    const [erros, setErros] = useState({});
    const [loading, setLoading] = useState(false);
    const v = (k,val) => setF(p=>({...p,[k]:val}));
    const prod = prods.find(p=>String(p.ID)===String(f.produto_id));
    const total = (parseInt(f.quantidade)||0)*(parseFloat(f.preco_unitario)||0);
    const validar = () => {
        const e={};
        if (!f.produto_id) e.produto_id='Selecione um produto';
        if (!f.fornecedor_id) e.fornecedor_id='Selecione um fornecedor';
        if (!f.quantidade||parseInt(f.quantidade)<=0) e.quantidade='Quantidade inválida';
        if (!f.preco_unitario||parseFloat(f.preco_unitario)<=0) e.preco_unitario='Preço inválido';
        setErros(e); return !Object.keys(e).length;
    };
    const salvar = async () => {
        if (!validar()) return;
        setLoading(true);
        try {
            const r=await axios.post(`${API}/entradas`,{produto_id:f.produto_id,fornecedor_id:f.fornecedor_id,quantidade:parseInt(f.quantidade),preco_unitario:parseFloat(f.preco_unitario),data_vencimento:f.data_vencimento||undefined});
            toast.success(r.data.msg); onSalvo();
        } catch(e) { toast.error(e.response?.data?.erro||'Erro ao registrar entrada'); }
        finally { setLoading(false); }
    };
    return (
        <div>
            <Field label="Produto" required error={erros.produto_id}>
                <select style={{...iSt(erros.produto_id),backgroundColor:'#fafafa'}} value={f.produto_id} onChange={e=>v('produto_id',e.target.value)}>
                    <option value="">Selecione um produto</option>
                    {prods.map(p=><option key={p.ID} value={p.ID}>{p.NOME_PRODUTO} (Estoque: {p.QUANTIDADE})</option>)}
                </select>
            </Field>
            <Field label="Fornecedor" required error={erros.fornecedor_id}>
                <select style={{...iSt(erros.fornecedor_id),backgroundColor:'#fafafa'}} value={f.fornecedor_id} onChange={e=>v('fornecedor_id',e.target.value)}>
                    <option value="">Selecione um fornecedor</option>
                    {forns.map(fn=><option key={fn.ID} value={fn.ID}>{fn.NOME_EMPRESA}</option>)}
                </select>
            </Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <Field label="Quantidade" required error={erros.quantidade}>
                    <input style={iSt(erros.quantidade)} type="number" min="1" value={f.quantidade} onChange={e=>v('quantidade',e.target.value)} placeholder="0"/>
                </Field>
                <Field label="Preço Unitário (R$)" required error={erros.preco_unitario}>
                    <input style={iSt(erros.preco_unitario)} type="number" step="0.01" value={f.preco_unitario} onChange={e=>v('preco_unitario',e.target.value)} placeholder="0,00"/>
                </Field>
            </div>
            <Field label="Data de Vencimento">
                <input style={iSt()} type="date" value={f.data_vencimento} onChange={e=>v('data_vencimento',e.target.value)}/>
            </Field>
            {total>0&&(
                <div style={{backgroundColor:'#fef2f2',border:`1px solid #fecaca`,borderRadius:8,padding:'10px 14px',marginBottom:14}}>
                    <p style={{margin:0,fontSize:13,color:C.danger,fontWeight:700}}>Total: R$ {fmt.brl(total)} · Débito será gerado para o fornecedor</p>
                </div>
            )}
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <Btn variant="ghost" onClick={onFechar}>Cancelar</Btn>
                <Btn onClick={salvar} disabled={loading}><ArrowDownCircle size={15}/>{loading?'Registrando...':'Registrar Entrada'}</Btn>
            </div>
        </div>
    );
}

function FornecedorForm({ item, onSalvo, onCancelar }) {
    const [f, setF] = useState({
        nome:'',cnpj:'',endereco:'',telefone:'',email:'',contato_principal:'',devido:'',condicao:'',
        ...(item?{nome:item.NOME_EMPRESA,cnpj:item.CNPJ||'',endereco:item.ENDERECO||'',telefone:item.TELEFONE||'',email:item.EMAIL||'',contato_principal:item.CONTATO_PRINCIPAL||'',devido:item.VALOR_DEVIDO||'',condicao:item.CONDICAO_PAGAMENTO||''}:{})
    });
    const [erros, setErros] = useState({});
    const [loading, setLoading] = useState(false);
    const v = (k,val) => setF(p=>({...p,[k]:val}));
    const validar = () => {
        const e={};
        if (!f.nome.trim()) e.nome='Campo obrigatório';
        if (!f.email.trim()) e.email='Campo obrigatório';
        else if (!emailOk(f.email)) e.email='E-mail inválido';
        if (!f.telefone.trim()) e.telefone='Campo obrigatório';
        if (!f.contato_principal.trim()) e.contato_principal='Campo obrigatório';
        if (f.cnpj&&f.cnpj.replace(/\D/g,'').length!==14) e.cnpj='CNPJ deve ter 14 dígitos';
        setErros(e); return !Object.keys(e).length;
    };
    const salvar = async () => {
        if (!validar()) return;
        setLoading(true);
        try {
            const payload={nome:clean(f.nome),cnpj:f.cnpj,endereco:clean(f.endereco),telefone:f.telefone,email:f.email,contato_principal:clean(f.contato_principal),devido:parseFloat(f.devido)||0,condicao:clean(f.condicao)};
            if (item) { await axios.put(`${API}/fornecedores/${item.ID}`,payload); toast.success('Fornecedor atualizado com sucesso!'); }
            else { await axios.post(`${API}/fornecedores`,payload); toast.success('Fornecedor cadastrado com sucesso!'); }
            onSalvo();
        } catch(e) { toast.error(e.response?.data?.erro||'Erro ao salvar fornecedor'); }
        finally { setLoading(false); }
    };
    return (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
            <div style={{gridColumn:'1/-1'}}>
                <Field label="Nome da Empresa" required error={erros.nome}>
                    <input style={iSt(erros.nome)} value={f.nome} onChange={e=>v('nome',e.target.value.toUpperCase())} placeholder="Insira o nome da empresa"/>
                </Field>
            </div>
            <Field label="CNPJ" error={erros.cnpj}>
                <input style={iSt(erros.cnpj)} value={f.cnpj} onChange={e=>v('cnpj',masks.cnpj(e.target.value))} placeholder="00.000.000/0000-00"/>
            </Field>
            <Field label="Telefone" required error={erros.telefone}>
                <input style={iSt(erros.telefone)} value={f.telefone} onChange={e=>v('telefone',masks.tel(e.target.value))} placeholder="(00) 00000-0000"/>
            </Field>
            <Field label="E-mail" required error={erros.email}>
                <input style={iSt(erros.email)} type="email" value={f.email} onChange={e=>v('email',e.target.value)} placeholder="exemplo@fornecedor.com"/>
            </Field>
            <Field label="Contato Principal" required error={erros.contato_principal}>
                <input style={iSt(erros.contato_principal)} value={f.contato_principal} onChange={e=>v('contato_principal',e.target.value)} placeholder="Nome do responsável"/>
            </Field>
            <div style={{gridColumn:'1/-1'}}>
                <Field label="Endereço">
                    <input style={iSt()} value={f.endereco} onChange={e=>v('endereco',e.target.value)} placeholder="Endereço completo"/>
                </Field>
            </div>
            <Field label="Valor Devido (R$)">
                <input style={iSt()} type="number" step="0.01" min="0" value={f.devido} onChange={e=>v('devido',e.target.value)} placeholder="0,00"/>
            </Field>
            <Field label="Condição de Pagamento">
                <input style={iSt()} value={f.condicao} onChange={e=>v('condicao',e.target.value.toUpperCase())} placeholder="Ex: 30/60/90 DDL"/>
            </Field>
            <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
                <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
                <Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':(item?'Atualizar Fornecedor':'Cadastrar Fornecedor')}</Btn>
            </div>
        </div>
    );
}

function Fornecedores() {
    const [rows, setRows] = useState([]);
    const [modal, setModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [search, setSearch] = useState('');
    const load = useCallback(async()=>{try{const r=await axios.get(`${API}/fornecedores`);setRows(r.data);}catch{toast.error('Erro ao carregar fornecedores');}},[]);
    useEffect(()=>{load();},[load]);
    const del = async(id)=>{if(!window.confirm('Confirma a exclusão?'))return;try{await axios.delete(`${API}/fornecedores/${id}`);toast.success('Fornecedor removido!');load();}catch(e){toast.error(e.response?.data?.erro||'Erro');}};
    const fmtCnpj = v=>v?v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'):'—';
    const filtered = rows.filter(r=>r.NOME_EMPRESA?.includes(search.toUpperCase())||r.CNPJ?.includes(search.replace(/\D/g,'')));
    return (
        <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
                <h2 style={titSt}>Fornecedores</h2>
                <Btn onClick={()=>{setEditItem(null);setModal(true);}}><Plus size={15}/>Novo Fornecedor</Btn>
            </div>
            <div style={{position:'relative',marginBottom:16}}>
                <Search size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:C.muted}}/>
                <input style={{...iSt(),paddingLeft:36}} placeholder="Pesquisar por nome ou CNPJ..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <Tabela cols={[{key:'NOME_EMPRESA',label:'Empresa'},{key:'CNPJ',label:'CNPJ',render:v=>fmtCnpj(v)},{key:'TELEFONE',label:'Telefone'},{key:'EMAIL',label:'E-mail'},{key:'CONTATO_PRINCIPAL',label:'Contato'},{key:'CONDICAO_PAGAMENTO',label:'Condição Pgto'},{key:'VALOR_DEVIDO',label:'Dívida',render:v=><span style={{color:v>0?C.danger:C.success,fontWeight:700}}>R$ {fmt.brl(v)}</span>}]} rows={filtered} onEdit={r=>{setEditItem(r);setModal(true);}} onDelete={del}/>
            {modal&&(<Modal title={editItem?'Editar Fornecedor':'Cadastro de Fornecedor'} onClose={()=>setModal(false)} wide><FornecedorForm item={editItem} onSalvo={()=>{setModal(false);load();}} onCancelar={()=>setModal(false)}/></Modal>)}
        </div>
    );
}

function ProdutoForm({ item, forns, onSalvo, onCancelar }) {
    const [f, setF] = useState({nome:'',codigo_barras:'',descricao:'',quantidade:'',preco:'',categoria:'',data_validade:'',fornecedor_id:'',...(item?{nome:item.NOME_PRODUTO,codigo_barras:item.CODIGO_BARRAS||'',descricao:item.DESCRICAO||'',quantidade:item.QUANTIDADE,preco:item.PRECO,categoria:item.CATEGORIA||'',data_validade:item.DATA_VALIDADE||'',fornecedor_id:item.FORNECEDOR_ID||''}:{})});
    const [erros, setErros] = useState({});
    const [loading, setLoading] = useState(false);
    const v = (k,val)=>setF(p=>({...p,[k]:val}));
    const validar = ()=>{const e={};if(!f.nome.trim())e.nome='Campo obrigatório';if(!f.descricao.trim())e.descricao='Campo obrigatório';if(!f.categoria)e.categoria='Selecione uma categoria';if(f.preco!==''&&parseFloat(f.preco)<0)e.preco='Preço não pode ser negativo';setErros(e);return!Object.keys(e).length;};
    const salvar = async()=>{if(!validar())return;setLoading(true);try{const payload={nome:clean(f.nome),codigo_barras:f.codigo_barras||undefined,descricao:clean(f.descricao),quantidade:parseInt(f.quantidade)||0,preco:parseFloat(f.preco)||0,categoria:f.categoria,data_validade:f.data_validade||undefined,fornecedor_id:f.fornecedor_id||undefined};if(item){await axios.put(`${API}/produtos/${item.ID}`,payload);toast.success('Produto atualizado!');}else{await axios.post(`${API}/produtos`,payload);toast.success('Produto cadastrado com sucesso!');}onSalvo();}catch(e){toast.error(e.response?.data?.erro||'Erro ao salvar produto');}finally{setLoading(false);}};
    return (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
            <div style={{gridColumn:'1/-1'}}><Field label="Nome do Produto" required error={erros.nome}><input style={iSt(erros.nome)} value={f.nome} onChange={e=>v('nome',e.target.value.toUpperCase())} placeholder="Insira o nome do produto"/></Field></div>
            <Field label="Código de Barras"><input style={iSt()} value={f.codigo_barras} onChange={e=>v('codigo_barras',masks.barras(e.target.value))} placeholder="Código de barras"/></Field>
            <Field label="Categoria" required error={erros.categoria}><select style={{...iSt(erros.categoria),backgroundColor:'#fafafa'}} value={f.categoria} onChange={e=>v('categoria',e.target.value)}><option value="">Selecione</option>{CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}</select></Field>
            <div style={{gridColumn:'1/-1'}}><Field label="Descrição" required error={erros.descricao}><textarea style={{...iSt(erros.descricao),minHeight:70,resize:'vertical'}} value={f.descricao} onChange={e=>v('descricao',clean(e.target.value))} placeholder="Descreva brevemente o produto"/></Field></div>
            <Field label="Quantidade em Estoque"><input style={iSt()} type="number" min="0" value={f.quantidade} onChange={e=>v('quantidade',e.target.value)} placeholder="0"/></Field>
            <Field label="Preço de Venda (R$)" error={erros.preco}><input style={iSt(erros.preco)} type="number" step="0.01" min="0" value={f.preco} onChange={e=>v('preco',e.target.value)} placeholder="0,00"/></Field>
            <Field label="Data de Validade"><input style={iSt()} type="date" value={f.data_validade} onChange={e=>v('data_validade',e.target.value)}/></Field>
            <Field label="Fornecedor Principal"><select style={{...iSt(),backgroundColor:'#fafafa'}} value={f.fornecedor_id} onChange={e=>v('fornecedor_id',e.target.value)}><option value="">Selecione</option>{forns.map(fn=><option key={fn.ID} value={fn.ID}>{fn.NOME_EMPRESA}</option>)}</select></Field>
            <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
                <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
                <Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':(item?'Atualizar Produto':'Cadastrar Produto')}</Btn>
            </div>
        </div>
    );
}

function Produtos({ forns }) {
    const [rows, setRows] = useState([]);
    const [modal, setModal] = useState(false);
    const [modalEntrada, setModalEntrada] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [search, setSearch] = useState('');
    const load = useCallback(async()=>{try{const r=await axios.get(`${API}/produtos`,{params:{search}});setRows(r.data.data||[]);}catch{toast.error('Erro ao carregar produtos');}},[search]);
    useEffect(()=>{load();},[load]);
    const del = async(id)=>{if(!window.confirm('Confirma a exclusão?'))return;try{await axios.delete(`${API}/produtos/${id}`);toast.success('Produto removido!');load();}catch(e){toast.error(e.response?.data?.erro||'Erro');}};
    return (
        <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
                <h2 style={titSt}>Produtos</h2>
                <div style={{display:'flex',gap:8}}>
                    <Btn variant="dark" onClick={()=>setModalEntrada(true)}><ArrowDownCircle size={15}/>Registrar Entrada</Btn>
                    <Btn onClick={()=>{setEditItem(null);setModal(true);}}><Plus size={15}/>Novo Produto</Btn>
                </div>
            </div>
            <div style={{position:'relative',marginBottom:16}}>
                <Search size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:C.muted}}/>
                <input style={{...iSt(),paddingLeft:36}} placeholder="Pesquisar por nome ou código de barras..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <Tabela cols={[{key:'NOME_PRODUTO',label:'Produto'},{key:'CODIGO_BARRAS',label:'Cód. Barras'},{key:'CATEGORIA',label:'Categoria',render:v=><span style={{backgroundColor:'#f0f0f0',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{v}</span>},{key:'QUANTIDADE',label:'Estoque',render:v=><span style={{color:v<=5?C.danger:v<=15?C.warn:C.success,fontWeight:700}}>{v}</span>},{key:'PRECO',label:'Preço',render:v=>`R$ ${fmt.brl(v)}`},{key:'FORNECEDOR_NOME',label:'Fornecedor'}]} rows={rows} onEdit={r=>{setEditItem(r);setModal(true);}} onDelete={del}/>
            {modal&&(<Modal title={editItem?'Editar Produto':'Cadastro de Produto'} onClose={()=>setModal(false)} wide><ProdutoForm item={editItem} forns={forns} onSalvo={()=>{setModal(false);load();}} onCancelar={()=>setModal(false)}/></Modal>)}
            {modalEntrada&&(<Modal title="Registrar Entrada de Estoque" onClose={()=>setModalEntrada(false)}><EntradaModal prods={rows} forns={forns} onSalvo={()=>{setModalEntrada(false);load();}} onFechar={()=>setModalEntrada(false)}/></Modal>)}
        </div>
    );
}

function Clientes() {
    const [rows, setRows] = useState([]);
    const [modal, setModal] = useState(false);
    const [lgpdModal, setLgpdModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [pendente, setPendente] = useState(null);
    const [f, setF] = useState({nome:'',cpf:'',tel:'',email:'',endereco:''});
    const [erros, setErros] = useState({});
    const load = useCallback(async()=>{try{const r=await axios.get(`${API}/clientes`);setRows(r.data);}catch{toast.error('Erro ao carregar clientes');}},[]);
    useEffect(()=>{load();},[load]);
    const vf = (k,val)=>setF(p=>({...p,[k]:val}));
    const validar = ()=>{const e={};if(!f.nome.trim())e.nome='Campo obrigatório';if(!f.tel.trim())e.tel='Campo obrigatório';if(f.email&&!emailOk(f.email))e.email='E-mail inválido';setErros(e);return!Object.keys(e).length;};
    const tentarSalvar = ()=>{if(!validar())return;if(!editItem){setPendente(f);setLgpdModal(true);}else salvar(f,true);};
    const salvar = async(dados,skipLgpd=false)=>{try{const payload={nome:clean(dados.nome),cpf:dados.cpf,tel:dados.tel,email:dados.email,endereco:clean(dados.endereco),consentimento_lgpd:skipLgpd?undefined:true};if(editItem){await axios.put(`${API}/clientes/${editItem.ID}`,payload);toast.success('Cliente atualizado!');}else{await axios.post(`${API}/clientes`,payload);toast.success('Cliente cadastrado com sucesso!');}setModal(false);setLgpdModal(false);setPendente(null);setF({nome:'',cpf:'',tel:'',email:'',endereco:''});load();}catch(e){toast.error(e.response?.data?.erro||'Erro ao salvar cliente');}};
    const del = async(id)=>{if(!window.confirm('Confirma a exclusão?'))return;try{await axios.delete(`${API}/clientes/${id}`);toast.success('Cliente removido!');load();}catch{toast.error('Erro');}};
    const lgpdEsquecer = async(id)=>{if(!window.confirm('Esta ação anonimiza permanentemente os dados pessoais conforme Art. 18 da LGPD. Confirma?'))return;try{await axios.delete(`${API}/clientes/${id}/lgpd`);toast.success('Dados anonimizados conforme LGPD!');load();}catch{toast.error('Erro');}};
    return (
        <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
                <h2 style={titSt}>Clientes</h2>
                <Btn onClick={()=>{setEditItem(null);setF({nome:'',cpf:'',tel:'',email:'',endereco:''});setModal(true);}}><Plus size={15}/>Novo Cliente</Btn>
            </div>
            <Tabela cols={[{key:'NOME_COMPLETO',label:'Nome'},{key:'TELEFONE',label:'Telefone'},{key:'EMAIL',label:'E-mail'},{key:'ULTIMA_COMPRA_DATA',label:'Última Compra',render:v=>fmt.data(v)},{key:'ULTIMA_COMPRA_VALOR',label:'Valor',render:v=>v>0?`R$ ${fmt.brl(v)}`:'—'}]} rows={rows} onEdit={r=>{setEditItem(r);setF({nome:r.NOME_COMPLETO,tel:r.TELEFONE||'',email:r.EMAIL||'',endereco:r.ENDERECO||''});setModal(true);}} onDelete={del} extraActions={r=><UserX size={15} title="Direito ao Esquecimento (LGPD Art. 18)" onClick={()=>lgpdEsquecer(r.ID)} style={{cursor:'pointer',color:C.warn,marginRight:12}}/>}/>
            {modal&&(
                <Modal title={editItem?'Editar Cliente':'Novo Cliente'} onClose={()=>setModal(false)}>
                    <Field label="Nome Completo" required error={erros.nome}><input style={iSt(erros.nome)} value={f.nome} onChange={e=>vf('nome',e.target.value.toUpperCase())} placeholder="Nome completo do cliente"/></Field>
                    <Field label="CPF (opcional — armazenado com criptografia AES)"><input style={iSt()} value={f.cpf} onChange={e=>vf('cpf',masks.cpf(e.target.value))} placeholder="000.000.000-00"/></Field>
                    <Field label="Telefone" required error={erros.tel}><input style={iSt(erros.tel)} value={f.tel} onChange={e=>vf('tel',masks.tel(e.target.value))} placeholder="(00) 00000-0000"/></Field>
                    <Field label="E-mail" error={erros.email}><input style={iSt(erros.email)} type="email" value={f.email} onChange={e=>vf('email',e.target.value)} placeholder="email@cliente.com"/></Field>
                    <Field label="Endereço"><input style={iSt()} value={f.endereco} onChange={e=>vf('endereco',e.target.value)} placeholder="Endereço completo"/></Field>
                    <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
                        <Btn variant="ghost" onClick={()=>setModal(false)}>Cancelar</Btn>
                        <Btn onClick={tentarSalvar}>{editItem?'Atualizar':'Cadastrar'}</Btn>
                    </div>
                </Modal>
            )}
            {lgpdModal&&<ModalLGPD onFechar={()=>{setLgpdModal(false);setPendente(null);}} onAceitar={()=>salvar(pendente)}/>}
        </div>
    );
}

function Associacao({ prods, forns }) {
    const [prodSel, setProdSel] = useState('');
    const [fornSel, setFornSel] = useState('');
    const [detalhe, setDetalhe] = useState(null);
    const buscarDetalhe = useCallback(async(id)=>{if(!id){setDetalhe(null);return;}try{const r=await axios.get(`${API}/produtos/${id}`);setDetalhe(r.data);}catch{toast.error('Erro ao buscar detalhes');}},[]);
    useEffect(()=>{buscarDetalhe(prodSel);},[prodSel,buscarDetalhe]);
    const associar = async()=>{if(!prodSel||!fornSel)return toast.error('Selecione produto e fornecedor');try{await axios.post(`${API}/associacao`,{produto_id:prodSel,fornecedor_id:fornSel});toast.success('Fornecedor associado com sucesso ao produto!');buscarDetalhe(prodSel);}catch(e){toast.error(e.response?.data?.erro||'Erro');}};
    const desassociar = async(fId)=>{if(!window.confirm('Confirma a desassociação?'))return;try{await axios.delete(`${API}/associacao`,{data:{produto_id:prodSel,fornecedor_id:fId}});toast.success('Fornecedor desassociado!');buscarDetalhe(prodSel);}catch{toast.error('Erro');}};
    const fmtCnpj = v=>v?v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'):'—';
    return (
        <div>
            <h2 style={titSt}>Associação de Fornecedor a Produto</h2>
            <div style={{backgroundColor:C.card,borderRadius:10,padding:24,boxShadow:'0 2px 12px rgba(0,0,0,0.06)',marginBottom:16}}>
                <Field label="Selecione o Produto">
                    <select style={{...iSt(),backgroundColor:'#fafafa'}} value={prodSel} onChange={e=>setProdSel(e.target.value)}>
                        <option value="">Selecione um produto</option>
                        {prods.map(p=><option key={p.ID} value={p.ID}>{p.NOME_PRODUTO} — Estoque: {p.QUANTIDADE}</option>)}
                    </select>
                </Field>
                {detalhe&&(<div style={{backgroundColor:'#f8f8f8',borderRadius:8,padding:'12px 14px',marginTop:4,fontSize:13}}><p style={{margin:'0 0 4px',fontWeight:700}}>{detalhe.NOME_PRODUTO}</p>{detalhe.CODIGO_BARRAS&&<p style={{margin:'0 0 2px',color:C.muted}}>Cód. Barras: {detalhe.CODIGO_BARRAS}</p>}{detalhe.DESCRICAO&&<p style={{margin:0,color:C.muted}}>{detalhe.DESCRICAO}</p>}</div>)}
            </div>
            {detalhe&&(
                <div style={{backgroundColor:C.card,borderRadius:10,padding:24,boxShadow:'0 2px 12px rgba(0,0,0,0.06)',marginBottom:16}}>
                    <h3 style={{margin:'0 0 14px',fontSize:12,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Associar Fornecedor</h3>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
                        <div style={{flex:1,minWidth:200}}><Field label="Fornecedor"><select style={{...iSt(),backgroundColor:'#fafafa'}} value={fornSel} onChange={e=>setFornSel(e.target.value)}><option value="">Selecione um fornecedor</option>{forns.map(fn=><option key={fn.ID} value={fn.ID}>{fn.NOME_EMPRESA}</option>)}</select></Field></div>
                        <div style={{paddingBottom:14}}><Btn onClick={associar}><Link2 size={15}/>Associar Fornecedor</Btn></div>
                    </div>
                </div>
            )}
            {detalhe?.fornecedores_associados?.length>0&&(
                <div style={{backgroundColor:C.card,borderRadius:10,padding:24,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
                    <h3 style={{margin:'0 0 14px',fontSize:12,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Fornecedores Associados</h3>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                        <thead><tr style={{borderBottom:`2px solid ${C.border}`}}><th style={{padding:'8px 12px',textAlign:'left',color:C.muted,fontSize:11,textTransform:'uppercase'}}>Nome</th><th style={{padding:'8px 12px',textAlign:'left',color:C.muted,fontSize:11,textTransform:'uppercase'}}>CNPJ</th><th/></tr></thead>
                        <tbody>{detalhe.fornecedores_associados.map(fn=>(<tr key={fn.ID} style={{borderBottom:`1px solid ${C.border}`}}><td style={{padding:'10px 12px'}}>{fn.NOME_EMPRESA}</td><td style={{padding:'10px 12px',color:C.muted}}>{fmtCnpj(fn.CNPJ)}</td><td style={{padding:'10px 12px'}}><Btn variant="danger" small onClick={()=>desassociar(fn.ID)}>Desassociar</Btn></td></tr>))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function PDV({ prods, clis }) {
    const [itens, setItens] = useState([{prod_id:'',qtd:1}]);
    const [cliId, setCli] = useState('');
    const [formaPag, setFormaPag] = useState('DINHEIRO');
    const [pago, setPago] = useState(true);
    const [dataVenc, setDataVenc] = useState('');
    const [loading, setLoading] = useState(false);
    const addItem = ()=>setItens(p=>[...p,{prod_id:'',qtd:1}]);
    const remItem = i=>setItens(p=>p.filter((_,idx)=>idx!==i));
    const setItem = (i,k,val)=>setItens(p=>p.map((it,idx)=>idx===i?{...it,[k]:val}:it));
    const getProd = id=>prods.find(p=>String(p.ID)===String(id));
    const temDesconto = FORMAS_DESCONTO.includes(formaPag);
    const subtotal = itens.reduce((s,it)=>s+(getProd(it.prod_id)?.PRECO||0)*(parseInt(it.qtd)||0),0);
    const desconto = temDesconto?subtotal*TAXA_DESCONTO:0;
    const total = subtotal-desconto;

    const registrar = async()=>{
        const validos=itens.filter(it=>it.prod_id&&it.qtd>0);
        if(!validos.length)return toast.error('Adicione ao menos um produto válido');
        setLoading(true);
        try{
            for(const it of validos){
                await axios.post(`${API}/vendas`,{cliente_id:cliId||undefined,produto_id:it.prod_id,quantidade:it.qtd,forma_pagamento:formaPag,pago:pago?1:0,data_vencimento:(!pago&&dataVenc)?dataVenc:undefined});
            }
            toast.success('Venda registrada com sucesso!');
            setItens([{prod_id:'',qtd:1}]);setCli('');setPago(true);setDataVenc('');
        }catch(e){toast.error(e.response?.data?.erro||'Erro ao registrar venda');}
        finally{setLoading(false);}
    };

    const gerarPDF = ()=>{
        const validos=itens.filter(it=>it.prod_id&&it.qtd>0);
        if(!validos.length)return toast.error('Adicione ao menos um produto');
        const cli=clis.find(c=>String(c.ID)===String(cliId));
        const doc=new jsPDF();
        doc.setFillColor(17,17,17);doc.rect(0,0,210,50,'F');
        try{doc.addImage(logoImg,'JPEG',14,8,32,32);}catch{}
        doc.setTextColor(255,255,255);doc.setFontSize(20);doc.setFont('helvetica','bold');
        doc.text('OLD SCHOOL GARAGE',52,22);
        doc.setFontSize(9);doc.setFont('helvetica','normal');
        doc.text('MANUTENÇÃO · PERFORMANCE · CUSTOMIZAÇÃO',52,30);
        doc.setTextColor(255,77,0);doc.setFontSize(20);doc.setFont('helvetica','bold');
        doc.text('ORÇAMENTO',52,44);
        doc.setTextColor(40,40,40);doc.setFontSize(10);doc.setFont('helvetica','normal');
        doc.text(`Cliente: ${cli?.NOME_COMPLETO||'Consumidor Final'}`,14,64);
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`,150,64);
        doc.text(`Nº: ${Date.now().toString().slice(-6)}`,150,70);
        const fator=temDesconto?(1-TAXA_DESCONTO):1;
        autoTable(doc,{
            startY:76,
            head:[['ITEM / DESCRIÇÃO','QTD','UNIT (R$)',temDesconto?'C/ DESC.':null,'TOTAL (R$)'].filter(Boolean)],
            body:validos.map(it=>{const p=getProd(it.prod_id);const pf=(p?.PRECO||0)*fator;const row=[p?.NOME_PRODUTO||'—',it.qtd,fmt.brl(p?.PRECO||0)];if(temDesconto)row.push(fmt.brl(pf));row.push(fmt.brl(pf*it.qtd));return row;}),
            headStyles:{fillColor:[255,77,0],textColor:255,fontStyle:'bold',fontSize:9},
            bodyStyles:{fontSize:10},alternateRowStyles:{fillColor:[248,248,248]},theme:'grid',
        });
        const y=doc.lastAutoTable.finalY+8;
        if(temDesconto){doc.setFontSize(10);doc.setTextColor(22,163,74);doc.text(`Desconto ${TAXA_DESCONTO*100}% (${formaPag}): - R$ ${fmt.brl(desconto)}`,14,y+6);}
        doc.setFillColor(255,77,0);doc.rect(130,y+(temDesconto?12:0),66,14,'F');
        doc.setTextColor(255,255,255);doc.setFontSize(11);doc.setFont('helvetica','bold');
        doc.text(`TOTAL: R$ ${fmt.brl(total)}`,134,y+(temDesconto?12:0)+9);
        doc.setTextColor(150);doc.setFontSize(8);doc.setFont('helvetica','normal');
        doc.text('Orçamento válido por 15 dias. Preços sujeitos a alteração.',14,y+(temDesconto?30:22));
        doc.save(`OSG_Orcamento_${cli?.NOME_COMPLETO?.replace(/ /g,'_')||'Sem_Cliente'}_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    return (
        <div>
            <h2 style={titSt}>PDV — Ponto de Venda / Orçamento</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20,alignItems:'start'}}>
                <div style={{backgroundColor:C.card,borderRadius:10,padding:24,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:4}}>
                        <Field label="Cliente (opcional)"><select style={{...iSt(),backgroundColor:'#fafafa'}} value={cliId} onChange={e=>setCli(e.target.value)}><option value="">Consumidor Final</option>{clis.map(c=><option key={c.ID} value={c.ID}>{c.NOME_COMPLETO}</option>)}</select></Field>
                        <Field label="Forma de Pagamento"><select style={{...iSt(),backgroundColor:'#fafafa'}} value={formaPag} onChange={e=>setFormaPag(e.target.value)}>{FORMAS_PAG.map(f=><option key={f} value={f}>{f}{FORMAS_DESCONTO.includes(f)?' — 10% OFF':''}</option>)}</select></Field>
                    </div>
                    {temDesconto&&(<div style={{display:'flex',alignItems:'center',gap:8,backgroundColor:'#f0fdf4',border:`1px solid #bbf7d0`,borderRadius:8,padding:'8px 14px',marginBottom:14}}><Tag size={14} style={{color:C.success}}/><span style={{fontSize:13,color:C.success,fontWeight:700}}>Desconto de 10% aplicado automaticamente para {formaPag}</span></div>)}
                    <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:14,flexWrap:'wrap'}}>
                        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
                            <input type="checkbox" checked={pago} onChange={e=>setPago(e.target.checked)} style={{width:16,height:16,accentColor:C.accent}}/>
                            <span style={{fontWeight:600}}>Pagamento à vista (recebido agora)</span>
                        </label>
                        {!pago&&(<div style={{flex:1,minWidth:160}}><Field label="Data de Vencimento"><input style={iSt()} type="date" value={dataVenc} onChange={e=>setDataVenc(e.target.value)}/></Field></div>)}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'0 0 12px'}}>
                        <span style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:'uppercase'}}>Itens</span>
                        <Btn small onClick={addItem}><Plus size={13}/>Adicionar Item</Btn>
                    </div>
                    {itens.map((it,i)=>{
                        const p=getProd(it.prod_id);
                        const pf=p?(p.PRECO*(temDesconto?1-TAXA_DESCONTO:1)):0;
                        return(
                            <div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
                                <select style={{...iSt(),flex:2}} value={it.prod_id} onChange={e=>setItem(i,'prod_id',e.target.value)}>
                                    <option value="">Selecione...</option>
                                    {prods.map(pr=><option key={pr.ID} value={pr.ID}>{pr.NOME_PRODUTO} — R$ {fmt.brl(pr.PRECO)}</option>)}
                                </select>
                                <input style={{...iSt(),width:64}} type="number" min="1" value={it.qtd} onChange={e=>setItem(i,'qtd',parseInt(e.target.value)||1)}/>
                                {p&&<span style={{fontSize:12,fontWeight:700,color:C.success,whiteSpace:'nowrap'}}>R$ {fmt.brl(pf*it.qtd)}</span>}
                                {itens.length>1&&<Minus size={16} onClick={()=>remItem(i)} style={{cursor:'pointer',color:C.danger,flexShrink:0}}/>}
                            </div>
                        );
                    })}
                </div>
                <div style={{backgroundColor:C.dark,borderRadius:10,padding:24,color:'#fff',position:'sticky',top:20}}>
                    <p style={{margin:'0 0 16px',fontSize:12,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:.5}}>Resumo</p>
                    {itens.filter(it=>it.prod_id).map((it,i)=>{const p=getProd(it.prod_id);return p?<div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:13}}><span style={{color:'#ccc'}}>{p.NOME_PRODUTO} x{it.qtd}</span><span style={{fontWeight:700}}>R$ {fmt.brl(p.PRECO*it.qtd)}</span></div>:null;})}
                    {temDesconto&&(<div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:12}}><span style={{color:'#4ade80'}}>Desconto 10% ({formaPag})</span><span style={{color:'#4ade80',fontWeight:700}}>- R$ {fmt.brl(desconto)}</span></div>)}
                    <div style={{borderTop:'1px solid #333',paddingTop:16,marginTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:700,textTransform:'uppercase',fontSize:13}}>Total</span>
                        <span style={{fontSize:22,fontWeight:900,color:C.accent}}>R$ {fmt.brl(total)}</span>
                    </div>
                    <div style={{marginTop:6,fontSize:12,color:'#888'}}>{formaPag} · {pago?'À vista':'Em aberto'}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:20}}>
                        <Btn onClick={registrar} disabled={loading}><CheckCircle size={15}/>{loading?'Registrando...':'Registrar Venda'}</Btn>
                        <Btn variant="dark" onClick={gerarPDF}><FileText size={15}/>Gerar PDF / Orçamento</Btn>
                    </div>
                </div>
            </div>
        </div>
    );
}

const titSt = {margin:'0 0 4px',fontSize:20,fontWeight:900,color:C.text,textTransform:'uppercase',letterSpacing:-.5};

function SistemaInterno() {
    const { usuario, logout } = useAuth();
    const [aba, setAba] = useState('dashboard');
    const [prods, setProds] = useState([]);
    const [clis, setClis] = useState([]);
    const [forns, setForns] = useState([]);

    const loadGlobal = useCallback(async()=>{
        try{
            const [p,c,f]=await Promise.all([axios.get(`${API}/produtos`),axios.get(`${API}/clientes`),axios.get(`${API}/fornecedores`)]);
            setProds(p.data.data||[]);setClis(c.data||[]);setForns(f.data||[]);
        }catch{}
    },[]);

    useEffect(()=>{loadGlobal();},[loadGlobal,aba]);

    const NavBtn = useCallback(({ id, Icon, label }) => (
        <button onClick={()=>setAba(id)} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'11px 14px',border:'none',borderRadius:8,marginBottom:4,cursor:'pointer',fontFamily:'inherit',backgroundColor:aba===id?C.accent:'transparent',color:aba===id?'#fff':C.muted,fontWeight:700,fontSize:12,textTransform:'uppercase',letterSpacing:.5,transition:'all .2s'}}>
            <Icon size={16}/>{label}
        </button>
    ), [aba]);

    return (
        <div style={{display:'flex',minHeight:'100vh',backgroundColor:C.bg,fontFamily:"'Segui UI',system-ui,sans-serif"}}>
            <style>{`*{box-sizing:border-box;}input:focus,select:focus,textarea:focus{border-color:${C.accent}!important;outline:none;box-shadow:0 0 0 3px rgba(255,77,0,0.1);}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:#f0f0f0;}::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px;}`}</style>
            <aside style={{width:230,backgroundColor:C.card,padding:'22px 14px',borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
                <div style={{textAlign:'center',marginBottom:24,paddingBottom:18,borderBottom:`1px solid ${C.border}`}}>
                    <img src={logoImg} alt="Old School Garage" style={{width:72,height:72,objectFit:'contain',borderRadius:'50%',border:`3px solid ${C.accent}`}}/>
                    <p style={{margin:'8px 0 0',fontSize:10,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Old School Garage</p>
                </div>
                <NavBtn id="dashboard" Icon={LayoutDashboard} label="Painel"/>
                <NavBtn id="produtos"  Icon={Package}          label="Produtos"/>
                <NavBtn id="forns"     Icon={Truck}            label="Fornecedores"/>
                <NavBtn id="assoc"     Icon={Link2}            label="Associações"/>
                <NavBtn id="clientes"  Icon={Users}            label="Clientes"/>
                <NavBtn id="pdv"       Icon={ShoppingCart}     label="PDV / Orçamento"/>
                <div style={{marginTop:'auto',paddingTop:18,borderTop:`1px solid ${C.border}`}}>
                    <div style={{backgroundColor:'#f8f8f8',borderRadius:8,padding:'10px 12px',marginBottom:10}}>
                        <p style={{margin:0,fontSize:11,fontWeight:700,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{usuario?.nome}</p>
                        <p style={{margin:'2px 0 0',fontSize:10,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{usuario?.email}</p>
                    </div>
                    <button onClick={logout} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',border:`1px solid ${C.border}`,borderRadius:8,cursor:'pointer',fontFamily:'inherit',backgroundColor:'transparent',color:C.danger,fontWeight:700,fontSize:12,textTransform:'uppercase',letterSpacing:.5}}>
                        <LogOut size={14}/>Sair
                    </button>
                    <div style={{fontSize:10,color:C.muted,textAlign:'center',lineHeight:1.7,marginTop:12}}>
                        <Shield size={11} style={{marginBottom:3}}/><br/>
                        Dados protegidos conforme<br/><strong>LGPD — Lei nº 13.709/2018</strong>
                    </div>
                </div>
            </aside>
            <main style={{flex:1,padding:26,overflowX:'hidden'}}>
                {aba==='dashboard'&&<Dashboard/>}
                {aba==='produtos' &&<Produtos  forns={forns}/>}
                {aba==='forns'    &&<Fornecedores/>}
                {aba==='assoc'    &&<Associacao prods={prods} forns={forns}/>}
                {aba==='clientes' &&<Clientes/>}
                {aba==='pdv'      &&<PDV prods={prods} clis={clis}/>}
            </main>
            <Toast/>
        </div>
    );
}

function AuthProvider({ children }) {
    const [token, setToken] = useState(getToken);
    const [usuario, setUsuario] = useState(getUsuario);
    const login = useCallback((tk, user) => {
        localStorage.setItem('osg_token', tk);
        localStorage.setItem('osg_usuario', JSON.stringify(user));
        setToken(tk); setUsuario(user);
    }, []);
    const logout = useCallback(() => {
        localStorage.removeItem('osg_token');
        localStorage.removeItem('osg_usuario');
        setToken(null); setUsuario(null);
    }, []);
    return <AuthContext.Provider value={{ token, usuario, login, logout }}>{children}</AuthContext.Provider>;
}

function AppConteudo() {
    const { token } = useAuth();
    return token ? <SistemaInterno/> : <TelaAuth/>;
}

export default function App() {
    return (
        <AuthProvider>
            <AppConteudo/>
        </AuthProvider>
    );
}