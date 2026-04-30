/**
 * OLD SCHOOL GARAGE — Sistema de Controle de Estoque
 * Backend: Node.js + Express + SQLite
 * Versão: 2.0.0
 * Conformidade: LGPD (Lei 13.709/2018), ABNT NBR ISO/IEC 27001
 */

const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const helmet = require('helmet');
const CryptoJS = require('crypto-js');
const rateLimit = require('express-rate-limit');

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || 'osg-secret-2026-change-in-prod';
const PORT = process.env.PORT || 3000;

// ─── Segurança ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ORIGIN || 'http://localhost:3001' }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { erro: 'Muitas requisições. Tente novamente em 15 minutos.' } }));

let db;

// ─── Banco de Dados ──────────────────────────────────────────────────────────
async function initDb() {
    db = await open({ filename: './database.db', driver: sqlite3.Database });
    await db.run('PRAGMA foreign_keys = ON');

    await db.run(`CREATE TABLE IF NOT EXISTS FORNECEDORES (
        ID                  INTEGER PRIMARY KEY AUTOINCREMENT,
        NOME_EMPRESA        TEXT    NOT NULL,
        CNPJ                TEXT    UNIQUE,
        ENDERECO            TEXT,
        TELEFONE            TEXT,
        EMAIL               TEXT,
        CONTATO_PRINCIPAL   TEXT,
        VALOR_DEVIDO        REAL    DEFAULT 0,
        CONDICAO_PAGAMENTO  TEXT,
        ATIVO               INTEGER DEFAULT 1,
        CRIADO_EM           TEXT    DEFAULT (datetime('now','localtime')),
        ATUALIZADO_EM       TEXT    DEFAULT (datetime('now','localtime'))
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS PRODUTOS (
        ID              INTEGER PRIMARY KEY AUTOINCREMENT,
        NOME_PRODUTO    TEXT    NOT NULL,
        CODIGO_BARRAS   TEXT    UNIQUE,
        DESCRICAO       TEXT,
        QUANTIDADE      INTEGER DEFAULT 0,
        PRECO           REAL    DEFAULT 0,
        CATEGORIA       TEXT    DEFAULT 'GERAL',
        DATA_VALIDADE   TEXT,
        FORNECEDOR_ID   INTEGER,
        ATIVO           INTEGER DEFAULT 1,
        CRIADO_EM       TEXT    DEFAULT (datetime('now','localtime')),
        ATUALIZADO_EM   TEXT    DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (FORNECEDOR_ID) REFERENCES FORNECEDORES(ID)
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS PRODUTO_FORNECEDOR (
        ID              INTEGER PRIMARY KEY AUTOINCREMENT,
        PRODUTO_ID      INTEGER NOT NULL,
        FORNECEDOR_ID   INTEGER NOT NULL,
        CRIADO_EM       TEXT    DEFAULT (datetime('now','localtime')),
        UNIQUE (PRODUTO_ID, FORNECEDOR_ID),
        FOREIGN KEY (PRODUTO_ID)    REFERENCES PRODUTOS(ID),
        FOREIGN KEY (FORNECEDOR_ID) REFERENCES FORNECEDORES(ID)
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS CLIENTES (
        ID                      INTEGER PRIMARY KEY AUTOINCREMENT,
        NOME_COMPLETO           TEXT    NOT NULL,
        CPF_CRIPTO              TEXT    UNIQUE,
        TELEFONE                TEXT,
        EMAIL                   TEXT,
        ENDERECO                TEXT,
        CONSENTIMENTO_LGPD      INTEGER DEFAULT 0,
        DATA_CONSENTIMENTO      TEXT,
        ULTIMA_COMPRA_DATA      TEXT,
        ULTIMA_COMPRA_VALOR     REAL    DEFAULT 0,
        ATIVO                   INTEGER DEFAULT 1,
        CRIADO_EM               TEXT    DEFAULT (datetime('now','localtime'))
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS VENDAS (
        ID              INTEGER PRIMARY KEY AUTOINCREMENT,
        CLIENTE_ID      INTEGER,
        PRODUTO_ID      INTEGER NOT NULL,
        QUANTIDADE      INTEGER NOT NULL,
        PRECO_UNITARIO  REAL    NOT NULL,
        TOTAL           REAL    NOT NULL,
        CRIADO_EM       TEXT    DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (CLIENTE_ID)  REFERENCES CLIENTES(ID),
        FOREIGN KEY (PRODUTO_ID)  REFERENCES PRODUTOS(ID)
    )`);

    // LGPD — Registro de auditoria (Art. 37, LGPD)
    await db.run(`CREATE TABLE IF NOT EXISTS AUDITORIA (
        ID              INTEGER PRIMARY KEY AUTOINCREMENT,
        TABELA          TEXT,
        OPERACAO        TEXT,
        REGISTRO_ID     INTEGER,
        DADOS_ANTERIORES TEXT,
        DADOS_NOVOS     TEXT,
        IP_ORIGEM       TEXT,
        CRIADO_EM       TEXT    DEFAULT (datetime('now','localtime'))
    )`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ok   = (res, data, status = 200)  => res.status(status).json(data);
const err  = (res, msg, status = 400)   => res.status(status).json({ erro: msg });
const wrap = (fn) => (req, res, next)   => Promise.resolve(fn(req, res, next)).catch(next);

async function audit(tabela, op, id, antes, depois, ip) {
    try {
        await db.run(
            'INSERT INTO AUDITORIA (TABELA, OPERACAO, REGISTRO_ID, DADOS_ANTERIORES, DADOS_NOVOS, IP_ORIGEM) VALUES (?,?,?,?,?,?)',
            [tabela, op, id, antes ? JSON.stringify(antes) : null, depois ? JSON.stringify(depois) : null, ip || 'N/A']
        );
    } catch (_) { /* auditoria nunca derruba a operação principal */ }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
app.get('/dashboard', wrap(async (req, res) => {
    const [prods, forns, clis, estoqueBaixo, vendas, recentes] = await Promise.all([
        db.get('SELECT COUNT(*) n FROM PRODUTOS WHERE ATIVO=1'),
        db.get('SELECT COUNT(*) n FROM FORNECEDORES WHERE ATIVO=1'),
        db.get('SELECT COUNT(*) n FROM CLIENTES WHERE ATIVO=1'),
        db.all('SELECT ID, NOME_PRODUTO, QUANTIDADE FROM PRODUTOS WHERE QUANTIDADE <= 5 AND ATIVO=1 ORDER BY QUANTIDADE'),
        db.get('SELECT COALESCE(SUM(TOTAL),0) total, COUNT(*) qtd FROM VENDAS'),
        db.all(`SELECT V.CRIADO_EM, V.TOTAL, P.NOME_PRODUTO, C.NOME_COMPLETO
                FROM VENDAS V
                LEFT JOIN PRODUTOS P ON V.PRODUTO_ID = P.ID
                LEFT JOIN CLIENTES C ON V.CLIENTE_ID = C.ID
                ORDER BY V.ID DESC LIMIT 5`)
    ]);
    ok(res, {
        total_produtos: prods.n,
        total_fornecedores: forns.n,
        total_clientes: clis.n,
        estoque_baixo: estoqueBaixo,
        total_vendas: vendas.total,
        qtd_vendas: vendas.qtd,
        vendas_recentes: recentes
    });
}));

// ─── PRODUTOS ────────────────────────────────────────────────────────────────
app.get('/produtos', wrap(async (req, res) => {
    const { search = '', page = 1, limit = 100 } = req.query;
    const like = `%${search.toUpperCase()}%`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const rows = await db.all(
        `SELECT P.*, F.NOME_EMPRESA FORNECEDOR_NOME
         FROM PRODUTOS P LEFT JOIN FORNECEDORES F ON P.FORNECEDOR_ID = F.ID
         WHERE P.ATIVO=1 AND (P.NOME_PRODUTO LIKE ? OR COALESCE(P.CODIGO_BARRAS,'') LIKE ?)
         ORDER BY P.NOME_PRODUTO LIMIT ? OFFSET ?`,
        [like, like, limit, offset]
    );
    const { n } = await db.get('SELECT COUNT(*) n FROM PRODUTOS WHERE ATIVO=1');
    ok(res, { data: rows, total: n, page: parseInt(page) });
}));

app.get('/produtos/:id', wrap(async (req, res) => {
    const prod = await db.get(
        `SELECT P.*, F.NOME_EMPRESA FORNECEDOR_NOME FROM PRODUTOS P
         LEFT JOIN FORNECEDORES F ON P.FORNECEDOR_ID = F.ID
         WHERE P.ID=? AND P.ATIVO=1`, [req.params.id]
    );
    if (!prod) return err(res, 'Produto não encontrado', 404);
    const fAssoc = await db.all(
        `SELECT F.ID, F.NOME_EMPRESA, F.CNPJ FROM FORNECEDORES F
         JOIN PRODUTO_FORNECEDOR PF ON F.ID = PF.FORNECEDOR_ID
         WHERE PF.PRODUTO_ID=?`, [req.params.id]
    );
    ok(res, { ...prod, fornecedores_associados: fAssoc });
}));

app.post('/produtos', wrap(async (req, res) => {
    const { nome, codigo_barras, descricao, quantidade, preco, categoria, data_validade, fornecedor_id } = req.body;
    if (!nome?.trim()) return err(res, 'Nome do produto é obrigatório');
    if (!descricao?.trim()) return err(res, 'Descrição é obrigatória');
    if (!categoria?.trim()) return err(res, 'Categoria é obrigatória');

    if (codigo_barras) {
        const dup = await db.get('SELECT ID FROM PRODUTOS WHERE CODIGO_BARRAS=? AND ATIVO=1', [codigo_barras]);
        if (dup) return err(res, 'Produto com este código de barras já está cadastrado!', 409);
    }

    const r = await db.run(
        'INSERT INTO PRODUTOS (NOME_PRODUTO,CODIGO_BARRAS,DESCRICAO,QUANTIDADE,PRECO,CATEGORIA,DATA_VALIDADE,FORNECEDOR_ID) VALUES (?,?,?,?,?,?,?,?)',
        [nome.toUpperCase().trim(), codigo_barras || null, descricao.trim(), parseInt(quantidade) || 0, parseFloat(preco) || 0, categoria.toUpperCase().trim(), data_validade || null, fornecedor_id || null]
    );
    await audit('PRODUTOS', 'INSERT', r.lastID, null, req.body, req.ip);
    ok(res, { msg: 'Produto cadastrado com sucesso!', id: r.lastID }, 201);
}));

app.put('/produtos/:id', wrap(async (req, res) => {
    const ant = await db.get('SELECT * FROM PRODUTOS WHERE ID=?', [req.params.id]);
    if (!ant) return err(res, 'Produto não encontrado', 404);
    const { nome, codigo_barras, descricao, quantidade, preco, categoria, data_validade, fornecedor_id } = req.body;
    await db.run(
        `UPDATE PRODUTOS SET NOME_PRODUTO=?,CODIGO_BARRAS=?,DESCRICAO=?,QUANTIDADE=?,PRECO=?,
         CATEGORIA=?,DATA_VALIDADE=?,FORNECEDOR_ID=?,ATUALIZADO_EM=datetime('now','localtime') WHERE ID=?`,
        [nome?.toUpperCase().trim() || ant.NOME_PRODUTO, codigo_barras || ant.CODIGO_BARRAS, descricao || ant.DESCRICAO,
         parseInt(quantidade) ?? ant.QUANTIDADE, parseFloat(preco) ?? ant.PRECO, categoria?.toUpperCase() || ant.CATEGORIA,
         data_validade || ant.DATA_VALIDADE, fornecedor_id || ant.FORNECEDOR_ID, req.params.id]
    );
    await audit('PRODUTOS', 'UPDATE', req.params.id, ant, req.body, req.ip);
    ok(res, { msg: 'Produto atualizado com sucesso!' });
}));

app.delete('/produtos/:id', wrap(async (req, res) => {
    const ant = await db.get('SELECT * FROM PRODUTOS WHERE ID=?', [req.params.id]);
    if (!ant) return err(res, 'Produto não encontrado', 404);
    await db.run('UPDATE PRODUTOS SET ATIVO=0 WHERE ID=?', [req.params.id]);
    await audit('PRODUTOS', 'DELETE', req.params.id, ant, null, req.ip);
    ok(res, { msg: 'Produto removido com sucesso!' });
}));

// ─── FORNECEDORES ────────────────────────────────────────────────────────────
app.get('/fornecedores', wrap(async (req, res) => {
    ok(res, await db.all('SELECT * FROM FORNECEDORES WHERE ATIVO=1 ORDER BY NOME_EMPRESA'));
}));

app.post('/fornecedores', wrap(async (req, res) => {
    const { nome, cnpj, endereco, telefone, email, contato_principal, devido, condicao } = req.body;
    if (!nome?.trim()) return err(res, 'Nome da empresa é obrigatório');
    if (!email?.trim()) return err(res, 'E-mail é obrigatório');
    if (!telefone?.trim()) return err(res, 'Telefone é obrigatório');
    if (!contato_principal?.trim()) return err(res, 'Contato principal é obrigatório');

    const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, '') : null;
    if (cnpjLimpo) {
        const dup = await db.get('SELECT ID FROM FORNECEDORES WHERE CNPJ=? AND ATIVO=1', [cnpjLimpo]);
        if (dup) return err(res, 'Fornecedor com esse CNPJ já está cadastrado!', 409);
    }

    const r = await db.run(
        'INSERT INTO FORNECEDORES (NOME_EMPRESA,CNPJ,ENDERECO,TELEFONE,EMAIL,CONTATO_PRINCIPAL,VALOR_DEVIDO,CONDICAO_PAGAMENTO) VALUES (?,?,?,?,?,?,?,?)',
        [nome.toUpperCase().trim(), cnpjLimpo, endereco?.trim(), telefone.trim(), email.toLowerCase().trim(), contato_principal.trim(), parseFloat(devido) || 0, condicao?.trim() || null]
    );
    await audit('FORNECEDORES', 'INSERT', r.lastID, null, req.body, req.ip);
    ok(res, { msg: 'Fornecedor cadastrado com sucesso!', id: r.lastID }, 201);
}));

app.put('/fornecedores/:id', wrap(async (req, res) => {
    const ant = await db.get('SELECT * FROM FORNECEDORES WHERE ID=?', [req.params.id]);
    if (!ant) return err(res, 'Fornecedor não encontrado', 404);
    const { nome, cnpj, endereco, telefone, email, contato_principal, devido, condicao } = req.body;
    const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, '') : ant.CNPJ;
    await db.run(
        `UPDATE FORNECEDORES SET NOME_EMPRESA=?,CNPJ=?,ENDERECO=?,TELEFONE=?,EMAIL=?,
         CONTATO_PRINCIPAL=?,VALOR_DEVIDO=?,CONDICAO_PAGAMENTO=?,ATUALIZADO_EM=datetime('now','localtime') WHERE ID=?`,
        [nome?.toUpperCase().trim() || ant.NOME_EMPRESA, cnpjLimpo, endereco?.trim() || ant.ENDERECO,
         telefone?.trim() || ant.TELEFONE, email?.toLowerCase().trim() || ant.EMAIL,
         contato_principal?.trim() || ant.CONTATO_PRINCIPAL, parseFloat(devido) ?? ant.VALOR_DEVIDO,
         condicao?.trim() || ant.CONDICAO_PAGAMENTO, req.params.id]
    );
    await audit('FORNECEDORES', 'UPDATE', req.params.id, ant, req.body, req.ip);
    ok(res, { msg: 'Fornecedor atualizado com sucesso!' });
}));

app.delete('/fornecedores/:id', wrap(async (req, res) => {
    const ant = await db.get('SELECT * FROM FORNECEDORES WHERE ID=?', [req.params.id]);
    if (!ant) return err(res, 'Fornecedor não encontrado', 404);
    await db.run('UPDATE FORNECEDORES SET ATIVO=0 WHERE ID=?', [req.params.id]);
    await audit('FORNECEDORES', 'DELETE', req.params.id, ant, null, req.ip);
    ok(res, { msg: 'Fornecedor removido com sucesso!' });
}));

// ─── CLIENTES ────────────────────────────────────────────────────────────────
app.get('/clientes', wrap(async (req, res) => {
    // CPF nunca é retornado (LGPD Art. 6)
    ok(res, await db.all(
        `SELECT ID, NOME_COMPLETO, TELEFONE, EMAIL, ENDERECO,
                CONSENTIMENTO_LGPD, DATA_CONSENTIMENTO,
                ULTIMA_COMPRA_DATA, ULTIMA_COMPRA_VALOR
         FROM CLIENTES WHERE ATIVO=1 ORDER BY NOME_COMPLETO`
    ));
}));

app.post('/clientes', wrap(async (req, res) => {
    const { nome, cpf, tel, email, endereco, consentimento_lgpd } = req.body;
    if (!nome?.trim()) return err(res, 'Nome completo é obrigatório');
    if (!tel?.trim()) return err(res, 'Telefone é obrigatório');
    // LGPD Art. 7 — consentimento explícito obrigatório
    if (!consentimento_lgpd) return err(res, 'O consentimento para tratamento de dados (LGPD) é obrigatório para realizar o cadastro.');

    const cripto = cpf ? CryptoJS.AES.encrypt(cpf.replace(/\D/g, ''), SECRET_KEY).toString() : null;
    const r = await db.run(
        'INSERT INTO CLIENTES (NOME_COMPLETO,CPF_CRIPTO,TELEFONE,EMAIL,ENDERECO,CONSENTIMENTO_LGPD,DATA_CONSENTIMENTO) VALUES (?,?,?,?,?,1,datetime("now","localtime"))',
        [nome.toUpperCase().trim(), cripto, tel.trim(), email?.toLowerCase().trim() || null, endereco?.trim() || null]
    );
    await audit('CLIENTES', 'INSERT', r.lastID, null, { nome, tel, email }, req.ip);
    ok(res, { msg: 'Cliente cadastrado com sucesso!', id: r.lastID }, 201);
}));

app.put('/clientes/:id', wrap(async (req, res) => {
    const ant = await db.get('SELECT * FROM CLIENTES WHERE ID=?', [req.params.id]);
    if (!ant) return err(res, 'Cliente não encontrado', 404);
    const { nome, tel, email, endereco } = req.body;
    await db.run(
        'UPDATE CLIENTES SET NOME_COMPLETO=?,TELEFONE=?,EMAIL=?,ENDERECO=? WHERE ID=?',
        [nome?.toUpperCase().trim() || ant.NOME_COMPLETO, tel?.trim() || ant.TELEFONE, email?.toLowerCase().trim() || ant.EMAIL, endereco?.trim() || ant.ENDERECO, req.params.id]
    );
    await audit('CLIENTES', 'UPDATE', req.params.id, { nome: ant.NOME_COMPLETO, tel: ant.TELEFONE }, req.body, req.ip);
    ok(res, { msg: 'Cliente atualizado com sucesso!' });
}));

app.delete('/clientes/:id', wrap(async (req, res) => {
    const ant = await db.get('SELECT * FROM CLIENTES WHERE ID=?', [req.params.id]);
    if (!ant) return err(res, 'Cliente não encontrado', 404);
    await db.run('UPDATE CLIENTES SET ATIVO=0 WHERE ID=?', [req.params.id]);
    await audit('CLIENTES', 'DELETE', req.params.id, ant, null, req.ip);
    ok(res, { msg: 'Cliente removido com sucesso!' });
}));

// LGPD — Direito ao esquecimento (Art. 18, VI)
app.delete('/clientes/:id/lgpd', wrap(async (req, res) => {
    await db.run(
        `UPDATE CLIENTES SET NOME_COMPLETO='[DADO REMOVIDO]',CPF_CRIPTO=NULL,
         TELEFONE=NULL,EMAIL=NULL,ENDERECO=NULL,ATIVO=0 WHERE ID=?`,
        [req.params.id]
    );
    await audit('CLIENTES', 'LGPD_ESQUECIMENTO', req.params.id, null, null, req.ip);
    ok(res, { msg: 'Dados pessoais anonimizados conforme Art. 18 da LGPD.' });
}));

// ─── ASSOCIAÇÃO PRODUTO ↔ FORNECEDOR ────────────────────────────────────────
app.post('/associacao', wrap(async (req, res) => {
    const { produto_id, fornecedor_id } = req.body;
    if (!produto_id || !fornecedor_id) return err(res, 'produto_id e fornecedor_id são obrigatórios');
    const existe = await db.get('SELECT ID FROM PRODUTO_FORNECEDOR WHERE PRODUTO_ID=? AND FORNECEDOR_ID=?', [produto_id, fornecedor_id]);
    if (existe) return err(res, 'Fornecedor já está associado a este produto!', 409);
    await db.run('INSERT INTO PRODUTO_FORNECEDOR (PRODUTO_ID,FORNECEDOR_ID) VALUES (?,?)', [produto_id, fornecedor_id]);
    await audit('PRODUTO_FORNECEDOR', 'INSERT', null, null, { produto_id, fornecedor_id }, req.ip);
    ok(res, { msg: 'Fornecedor associado com sucesso ao produto!' }, 201);
}));

app.delete('/associacao', wrap(async (req, res) => {
    const { produto_id, fornecedor_id } = req.body;
    await db.run('DELETE FROM PRODUTO_FORNECEDOR WHERE PRODUTO_ID=? AND FORNECEDOR_ID=?', [produto_id, fornecedor_id]);
    await audit('PRODUTO_FORNECEDOR', 'DELETE', null, { produto_id, fornecedor_id }, null, req.ip);
    ok(res, { msg: 'Fornecedor desassociado com sucesso!' });
}));

// ─── VENDAS ──────────────────────────────────────────────────────────────────
app.post('/vendas', wrap(async (req, res) => {
    const { cliente_id, produto_id, quantidade } = req.body;
    if (!produto_id || !quantidade) return err(res, 'produto_id e quantidade são obrigatórios');
    const prod = await db.get('SELECT * FROM PRODUTOS WHERE ID=? AND ATIVO=1', [produto_id]);
    if (!prod) return err(res, 'Produto não encontrado', 404);
    if (prod.QUANTIDADE < parseInt(quantidade)) return err(res, `Estoque insuficiente. Disponível: ${prod.QUANTIDADE}`);
    const total = prod.PRECO * parseInt(quantidade);
    const r = await db.run(
        'INSERT INTO VENDAS (CLIENTE_ID,PRODUTO_ID,QUANTIDADE,PRECO_UNITARIO,TOTAL) VALUES (?,?,?,?,?)',
        [cliente_id || null, produto_id, quantidade, prod.PRECO, total]
    );
    await db.run('UPDATE PRODUTOS SET QUANTIDADE=QUANTIDADE-? WHERE ID=?', [quantidade, produto_id]);
    if (cliente_id) await db.run('UPDATE CLIENTES SET ULTIMA_COMPRA_DATA=datetime("now","localtime"),ULTIMA_COMPRA_VALOR=? WHERE ID=?', [total, cliente_id]);
    await audit('VENDAS', 'INSERT', r.lastID, null, req.body, req.ip);
    ok(res, { msg: 'Venda registrada!', id: r.lastID, total }, 201);
}));

app.get('/vendas', wrap(async (req, res) => {
    ok(res, await db.all(
        `SELECT V.*, P.NOME_PRODUTO, C.NOME_COMPLETO CLIENTE_NOME
         FROM VENDAS V
         LEFT JOIN PRODUTOS P ON V.PRODUTO_ID = P.ID
         LEFT JOIN CLIENTES C ON V.CLIENTE_ID = C.ID
         ORDER BY V.ID DESC LIMIT 50`
    ));
}));

// ─── Tratamento global de erros ──────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error(`[ERRO] ${req.method} ${req.path}:`, err.message);
    res.status(500).json({ erro: 'Erro interno do servidor. Tente novamente.' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
initDb()
    .then(() => app.listen(PORT, () => console.log(`\n✅  Old School Garage API rodando em http://localhost:${PORT}\n`)))
    .catch(e => { console.error('Falha ao inicializar banco:', e); process.exit(1); });