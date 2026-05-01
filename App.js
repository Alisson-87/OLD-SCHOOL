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
const FORMAS_DESCONTO = ['DINHEIRO', 'PIX'];
const TAXA_DESCONTO = 0.10;

app.use(helmet());
app.use(cors({ origin: process.env.ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições. Tente novamente em 15 minutos.' }
}));

let db;

function sanitize(value) {
    if (typeof value !== 'string') return value;
    return value.replace(/[<>]/g, '').trim();
}

function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarCnpj(cnpj) {
    const c = cnpj.replace(/\D/g, '');
    if (c.length !== 14) return false;
    if (/^(\d)\1+$/.test(c)) return false;
    const calc = (len) => {
        let sum = 0, pos = len - 7;
        for (let i = len; i >= 1; i--) {
            sum += parseInt(c.charAt(len - i)) * pos--;
            if (pos < 2) pos = 9;
        }
        const r = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return r === parseInt(c.charAt(len));
    };
    return calc(12) && calc(13);
}

async function initDb() {
    db = await open({ filename: './database.db', driver: sqlite3.Database });
    await db.run('PRAGMA foreign_keys = ON');
    await db.run('PRAGMA journal_mode = WAL');

    await db.run(`CREATE TABLE IF NOT EXISTS FORNECEDORES (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        NOME_EMPRESA TEXT NOT NULL,
        CNPJ TEXT UNIQUE,
        ENDERECO TEXT,
        TELEFONE TEXT,
        EMAIL TEXT,
        CONTATO_PRINCIPAL TEXT,
        VALOR_DEVIDO REAL DEFAULT 0,
        CONDICAO_PAGAMENTO TEXT,
        ATIVO INTEGER DEFAULT 1,
        CRIADO_EM TEXT DEFAULT (datetime('now','localtime')),
        ATUALIZADO_EM TEXT DEFAULT (datetime('now','localtime'))
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS PRODUTOS (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        NOME_PRODUTO TEXT NOT NULL,
        CODIGO_BARRAS TEXT UNIQUE,
        DESCRICAO TEXT,
        QUANTIDADE INTEGER DEFAULT 0,
        PRECO REAL DEFAULT 0,
        CATEGORIA TEXT DEFAULT 'GERAL',
        DATA_VALIDADE TEXT,
        FORNECEDOR_ID INTEGER,
        ATIVO INTEGER DEFAULT 1,
        CRIADO_EM TEXT DEFAULT (datetime('now','localtime')),
        ATUALIZADO_EM TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (FORNECEDOR_ID) REFERENCES FORNECEDORES(ID)
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS PRODUTO_FORNECEDOR (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        PRODUTO_ID INTEGER NOT NULL,
        FORNECEDOR_ID INTEGER NOT NULL,
        CRIADO_EM TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE (PRODUTO_ID, FORNECEDOR_ID),
        FOREIGN KEY (PRODUTO_ID) REFERENCES PRODUTOS(ID),
        FOREIGN KEY (FORNECEDOR_ID) REFERENCES FORNECEDORES(ID)
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS CLIENTES (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        NOME_COMPLETO TEXT NOT NULL,
        CPF_CRIPTO TEXT UNIQUE,
        TELEFONE TEXT,
        EMAIL TEXT,
        ENDERECO TEXT,
        CONSENTIMENTO_LGPD INTEGER DEFAULT 0,
        DATA_CONSENTIMENTO TEXT,
        ULTIMA_COMPRA_DATA TEXT,
        ULTIMA_COMPRA_VALOR REAL DEFAULT 0,
        ATIVO INTEGER DEFAULT 1,
        CRIADO_EM TEXT DEFAULT (datetime('now','localtime'))
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS ENTRADAS (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        PRODUTO_ID INTEGER NOT NULL,
        FORNECEDOR_ID INTEGER NOT NULL,
        QUANTIDADE INTEGER NOT NULL,
        PRECO_UNITARIO REAL NOT NULL,
        TOTAL REAL NOT NULL,
        DATA_VENCIMENTO TEXT,
        PAGO INTEGER DEFAULT 0,
        DATA_PAGAMENTO TEXT,
        CRIADO_EM TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (PRODUTO_ID) REFERENCES PRODUTOS(ID),
        FOREIGN KEY (FORNECEDOR_ID) REFERENCES FORNECEDORES(ID)
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS VENDAS (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        CLIENTE_ID INTEGER,
        PRODUTO_ID INTEGER NOT NULL,
        QUANTIDADE INTEGER NOT NULL,
        PRECO_UNITARIO REAL NOT NULL,
        DESCONTO_PERCENTUAL REAL DEFAULT 0,
        TOTAL REAL NOT NULL,
        FORMA_PAGAMENTO TEXT DEFAULT 'DINHEIRO',
        PAGO INTEGER DEFAULT 1,
        DATA_VENCIMENTO TEXT,
        DATA_PAGAMENTO TEXT,
        CRIADO_EM TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (CLIENTE_ID) REFERENCES CLIENTES(ID),
        FOREIGN KEY (PRODUTO_ID) REFERENCES PRODUTOS(ID)
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS AUDITORIA (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        TABELA TEXT NOT NULL,
        OPERACAO TEXT NOT NULL,
        REGISTRO_ID INTEGER,
        DADOS_ANTERIORES TEXT,
        DADOS_NOVOS TEXT,
        IP_ORIGEM TEXT,
        CRIADO_EM TEXT DEFAULT (datetime('now','localtime'))
    )`);

    const colsVendas = await db.all('PRAGMA table_info(VENDAS)');
    const nomesVendas = colsVendas.map(c => c.name);
    if (!nomesVendas.includes('FORMA_PAGAMENTO')) await db.run("ALTER TABLE VENDAS ADD COLUMN FORMA_PAGAMENTO TEXT DEFAULT 'DINHEIRO'");
    if (!nomesVendas.includes('PAGO')) await db.run('ALTER TABLE VENDAS ADD COLUMN PAGO INTEGER DEFAULT 1');
    if (!nomesVendas.includes('DATA_VENCIMENTO')) await db.run('ALTER TABLE VENDAS ADD COLUMN DATA_VENCIMENTO TEXT');
    if (!nomesVendas.includes('DATA_PAGAMENTO')) await db.run('ALTER TABLE VENDAS ADD COLUMN DATA_PAGAMENTO TEXT');
    if (!nomesVendas.includes('DESCONTO_PERCENTUAL')) await db.run('ALTER TABLE VENDAS ADD COLUMN DESCONTO_PERCENTUAL REAL DEFAULT 0');
}

const ok   = (res, data, status = 200) => res.status(status).json(data);
const fail = (res, msg, status = 400) => res.status(status).json({ erro: msg });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function audit(tabela, op, id, antes, depois, ip) {
    try {
        await db.run(
            'INSERT INTO AUDITORIA (TABELA,OPERACAO,REGISTRO_ID,DADOS_ANTERIORES,DADOS_NOVOS,IP_ORIGEM) VALUES (?,?,?,?,?,?)',
            [tabela, op, id, antes ? JSON.stringify(antes) : null, depois ? JSON.stringify(depois) : null, ip || 'N/A']
        );
    } catch (_) {}
}

app.get('/dashboard', wrap(async (req, res) => {
    const [totalProds, totalForns, totalClis, totalVendas, totalAPagar, totalAReceber] = await Promise.all([
        db.get('SELECT COUNT(*) n FROM PRODUTOS WHERE ATIVO=1'),
        db.get('SELECT COUNT(*) n FROM FORNECEDORES WHERE ATIVO=1'),
        db.get('SELECT COUNT(*) n FROM CLIENTES WHERE ATIVO=1'),
        db.get('SELECT COALESCE(SUM(TOTAL),0) total, COUNT(*) qtd FROM VENDAS'),
        db.get('SELECT COALESCE(SUM(VALOR_DEVIDO),0) total FROM FORNECEDORES WHERE ATIVO=1'),
        db.get('SELECT COALESCE(SUM(TOTAL),0) total FROM VENDAS WHERE PAGO=0'),
    ]);

    const [estoqueBaixo, vendasRecentes, contasAPagar, contasAReceber] = await Promise.all([
        db.all('SELECT ID,NOME_PRODUTO,QUANTIDADE FROM PRODUTOS WHERE QUANTIDADE<=5 AND ATIVO=1 ORDER BY QUANTIDADE ASC'),
        db.all(`SELECT V.ID,V.CRIADO_EM,V.TOTAL,V.PAGO,V.FORMA_PAGAMENTO,V.DESCONTO_PERCENTUAL,P.NOME_PRODUTO,C.NOME_COMPLETO
                FROM VENDAS V LEFT JOIN PRODUTOS P ON V.PRODUTO_ID=P.ID LEFT JOIN CLIENTES C ON V.CLIENTE_ID=C.ID
                ORDER BY V.ID DESC LIMIT 5`),
        db.all(`SELECT E.ID,E.TOTAL,E.DATA_VENCIMENTO,E.CRIADO_EM,P.NOME_PRODUTO,F.NOME_EMPRESA
                FROM ENTRADAS E JOIN PRODUTOS P ON E.PRODUTO_ID=P.ID JOIN FORNECEDORES F ON E.FORNECEDOR_ID=F.ID
                WHERE E.PAGO=0 ORDER BY E.DATA_VENCIMENTO ASC LIMIT 10`),
        db.all(`SELECT V.ID,V.TOTAL,V.DATA_VENCIMENTO,V.CRIADO_EM,P.NOME_PRODUTO,C.NOME_COMPLETO
                FROM VENDAS V LEFT JOIN PRODUTOS P ON V.PRODUTO_ID=P.ID LEFT JOIN CLIENTES C ON V.CLIENTE_ID=C.ID
                WHERE V.PAGO=0 ORDER BY V.DATA_VENCIMENTO ASC LIMIT 10`),
    ]);

    ok(res, {
        total_produtos: totalProds.n,
        total_fornecedores: totalForns.n,
        total_clientes: totalClis.n,
        total_vendas: totalVendas.total,
        qtd_vendas: totalVendas.qtd,
        total_a_pagar: totalAPagar.total,
        total_a_receber: totalAReceber.total,
        estoque_baixo: estoqueBaixo,
        vendas_recentes: vendasRecentes,
        contas_a_pagar: contasAPagar,
        contas_a_receber: contasAReceber,
    });
}));

app.get('/produtos', wrap(async (req, res) => {
    const search = sanitize(String(req.query.search || ''));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const like = `%${search.toUpperCase()}%`;
    const offset = (page - 1) * limit;
    const rows = await db.all(
        `SELECT P.*,F.NOME_EMPRESA FORNECEDOR_NOME FROM PRODUTOS P
         LEFT JOIN FORNECEDORES F ON P.FORNECEDOR_ID=F.ID
         WHERE P.ATIVO=1 AND (P.NOME_PRODUTO LIKE ? OR COALESCE(P.CODIGO_BARRAS,'') LIKE ?)
         ORDER BY P.NOME_PRODUTO LIMIT ? OFFSET ?`,
        [like, like, limit, offset]
    );
    const { n } = await db.get('SELECT COUNT(*) n FROM PRODUTOS WHERE ATIVO=1');
    ok(res, { data: rows, total: n, page });
}));

app.get('/produtos/:id', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const prod = await db.get(
        `SELECT P.*,F.NOME_EMPRESA FORNECEDOR_NOME FROM PRODUTOS P
         LEFT JOIN FORNECEDORES F ON P.FORNECEDOR_ID=F.ID WHERE P.ID=? AND P.ATIVO=1`,
        [id]
    );
    if (!prod) return fail(res, 'Produto não encontrado', 404);
    const fAssoc = await db.all(
        `SELECT F.ID,F.NOME_EMPRESA,F.CNPJ FROM FORNECEDORES F
         JOIN PRODUTO_FORNECEDOR PF ON F.ID=PF.FORNECEDOR_ID WHERE PF.PRODUTO_ID=?`,
        [id]
    );
    ok(res, { ...prod, fornecedores_associados: fAssoc });
}));

app.post('/produtos', wrap(async (req, res) => {
    const nome = sanitize(req.body.nome || '');
    const descricao = sanitize(req.body.descricao || '');
    const categoria = sanitize(req.body.categoria || '');
    const codigo_barras = sanitize(req.body.codigo_barras || '');
    const data_validade = sanitize(req.body.data_validade || '');
    const quantidade = parseInt(req.body.quantidade) || 0;
    const preco = parseFloat(req.body.preco) || 0;
    const fornecedor_id = parseInt(req.body.fornecedor_id) || null;

    if (!nome) return fail(res, 'Nome do produto é obrigatório');
    if (!descricao) return fail(res, 'Descrição é obrigatória');
    if (!categoria) return fail(res, 'Categoria é obrigatória');
    if (preco < 0) return fail(res, 'Preço não pode ser negativo');
    if (quantidade < 0) return fail(res, 'Quantidade não pode ser negativa');

    if (codigo_barras) {
        const dup = await db.get('SELECT ID FROM PRODUTOS WHERE CODIGO_BARRAS=? AND ATIVO=1', [codigo_barras]);
        if (dup) return fail(res, 'Produto com este código de barras já está cadastrado!', 409);
    }

    const r = await db.run(
        'INSERT INTO PRODUTOS (NOME_PRODUTO,CODIGO_BARRAS,DESCRICAO,QUANTIDADE,PRECO,CATEGORIA,DATA_VALIDADE,FORNECEDOR_ID) VALUES (?,?,?,?,?,?,?,?)',
        [nome.toUpperCase(), codigo_barras || null, descricao, quantidade, preco, categoria.toUpperCase(), data_validade || null, fornecedor_id]
    );
    await audit('PRODUTOS', 'INSERT', r.lastID, null, { nome, categoria }, req.ip);
    ok(res, { msg: 'Produto cadastrado com sucesso!', id: r.lastID }, 201);
}));

app.put('/produtos/:id', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const ant = await db.get('SELECT * FROM PRODUTOS WHERE ID=?', [id]);
    if (!ant) return fail(res, 'Produto não encontrado', 404);

    const nome = sanitize(req.body.nome || '') || ant.NOME_PRODUTO;
    const descricao = sanitize(req.body.descricao || '') || ant.DESCRICAO;
    const categoria = sanitize(req.body.categoria || '') || ant.CATEGORIA;
    const codigo_barras = sanitize(req.body.codigo_barras || '') || ant.CODIGO_BARRAS;
    const data_validade = sanitize(req.body.data_validade || '') || ant.DATA_VALIDADE;
    const quantidade = req.body.quantidade !== undefined ? parseInt(req.body.quantidade) : ant.QUANTIDADE;
    const preco = req.body.preco !== undefined ? parseFloat(req.body.preco) : ant.PRECO;
    const fornecedor_id = req.body.fornecedor_id ? parseInt(req.body.fornecedor_id) : ant.FORNECEDOR_ID;

    await db.run(
        `UPDATE PRODUTOS SET NOME_PRODUTO=?,CODIGO_BARRAS=?,DESCRICAO=?,QUANTIDADE=?,PRECO=?,
         CATEGORIA=?,DATA_VALIDADE=?,FORNECEDOR_ID=?,ATUALIZADO_EM=datetime('now','localtime') WHERE ID=?`,
        [nome.toUpperCase(), codigo_barras, descricao, quantidade, preco, categoria.toUpperCase(), data_validade, fornecedor_id, id]
    );
    await audit('PRODUTOS', 'UPDATE', id, ant, req.body, req.ip);
    ok(res, { msg: 'Produto atualizado com sucesso!' });
}));

app.delete('/produtos/:id', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const ant = await db.get('SELECT * FROM PRODUTOS WHERE ID=?', [id]);
    if (!ant) return fail(res, 'Produto não encontrado', 404);
    await db.run('UPDATE PRODUTOS SET ATIVO=0 WHERE ID=?', [id]);
    await audit('PRODUTOS', 'DELETE', id, ant, null, req.ip);
    ok(res, { msg: 'Produto removido com sucesso!' });
}));

app.get('/entradas', wrap(async (req, res) => {
    ok(res, await db.all(`
        SELECT E.*,P.NOME_PRODUTO,F.NOME_EMPRESA FROM ENTRADAS E
        JOIN PRODUTOS P ON E.PRODUTO_ID=P.ID JOIN FORNECEDORES F ON E.FORNECEDOR_ID=F.ID
        ORDER BY E.ID DESC LIMIT 50
    `));
}));

app.post('/entradas', wrap(async (req, res) => {
    const produto_id = parseInt(req.body.produto_id);
    const fornecedor_id = parseInt(req.body.fornecedor_id);
    const quantidade = parseInt(req.body.quantidade);
    const preco_unitario = parseFloat(req.body.preco_unitario);
    const data_vencimento = sanitize(req.body.data_vencimento || '');

    if (!produto_id) return fail(res, 'Produto é obrigatório');
    if (!fornecedor_id) return fail(res, 'Fornecedor é obrigatório');
    if (!quantidade || quantidade <= 0) return fail(res, 'Quantidade deve ser maior que zero');
    if (!preco_unitario || preco_unitario <= 0) return fail(res, 'Preço unitário deve ser maior que zero');

    const prod = await db.get('SELECT * FROM PRODUTOS WHERE ID=? AND ATIVO=1', [produto_id]);
    if (!prod) return fail(res, 'Produto não encontrado', 404);
    const forn = await db.get('SELECT * FROM FORNECEDORES WHERE ID=? AND ATIVO=1', [fornecedor_id]);
    if (!forn) return fail(res, 'Fornecedor não encontrado', 404);

    const total = quantidade * preco_unitario;
    const r = await db.run(
        'INSERT INTO ENTRADAS (PRODUTO_ID,FORNECEDOR_ID,QUANTIDADE,PRECO_UNITARIO,TOTAL,DATA_VENCIMENTO) VALUES (?,?,?,?,?,?)',
        [produto_id, fornecedor_id, quantidade, preco_unitario, total, data_vencimento || null]
    );
    await db.run("UPDATE PRODUTOS SET QUANTIDADE=QUANTIDADE+?,ATUALIZADO_EM=datetime('now','localtime') WHERE ID=?", [quantidade, produto_id]);
    await db.run("UPDATE FORNECEDORES SET VALOR_DEVIDO=VALOR_DEVIDO+?,ATUALIZADO_EM=datetime('now','localtime') WHERE ID=?", [total, fornecedor_id]);
    await audit('ENTRADAS', 'INSERT', r.lastID, null, req.body, req.ip);
    ok(res, { msg: `Entrada registrada! +${quantidade} un. de "${prod.NOME_PRODUTO}". Débito de R$ ${total.toFixed(2)} gerado para "${forn.NOME_EMPRESA}".`, id: r.lastID }, 201);
}));

app.patch('/entradas/:id/pagar', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const entrada = await db.get('SELECT * FROM ENTRADAS WHERE ID=?', [id]);
    if (!entrada) return fail(res, 'Entrada não encontrada', 404);
    if (entrada.PAGO) return fail(res, 'Esta entrada já foi paga');
    await db.run("UPDATE ENTRADAS SET PAGO=1,DATA_PAGAMENTO=datetime('now','localtime') WHERE ID=?", [id]);
    await db.run("UPDATE FORNECEDORES SET VALOR_DEVIDO=MAX(0,VALOR_DEVIDO-?),ATUALIZADO_EM=datetime('now','localtime') WHERE ID=?", [entrada.TOTAL, entrada.FORNECEDOR_ID]);
    await audit('ENTRADAS', 'PAGAR', id, entrada, null, req.ip);
    ok(res, { msg: 'Pagamento ao fornecedor registrado com sucesso!' });
}));

app.get('/fornecedores', wrap(async (req, res) => {
    ok(res, await db.all('SELECT * FROM FORNECEDORES WHERE ATIVO=1 ORDER BY NOME_EMPRESA'));
}));

app.post('/fornecedores', wrap(async (req, res) => {
    const nome = sanitize(req.body.nome || '');
    const email = sanitize(req.body.email || '');
    const telefone = sanitize(req.body.telefone || '');
    const contato_principal = sanitize(req.body.contato_principal || '');
    const endereco = sanitize(req.body.endereco || '');
    const condicao = sanitize(req.body.condicao || '');
    const cnpj = req.body.cnpj ? req.body.cnpj.replace(/\D/g, '') : null;
    const devido = parseFloat(req.body.devido) || 0;

    if (!nome) return fail(res, 'Nome da empresa é obrigatório');
    if (!email) return fail(res, 'E-mail é obrigatório');
    if (!validarEmail(email)) return fail(res, 'E-mail inválido');
    if (!telefone) return fail(res, 'Telefone é obrigatório');
    if (!contato_principal) return fail(res, 'Contato principal é obrigatório');
    if (cnpj && !validarCnpj(cnpj)) return fail(res, 'CNPJ inválido');

    if (cnpj) {
        const dup = await db.get('SELECT ID FROM FORNECEDORES WHERE CNPJ=? AND ATIVO=1', [cnpj]);
        if (dup) return fail(res, 'Fornecedor com esse CNPJ já está cadastrado!', 409);
    }

    const r = await db.run(
        'INSERT INTO FORNECEDORES (NOME_EMPRESA,CNPJ,ENDERECO,TELEFONE,EMAIL,CONTATO_PRINCIPAL,VALOR_DEVIDO,CONDICAO_PAGAMENTO) VALUES (?,?,?,?,?,?,?,?)',
        [nome.toUpperCase(), cnpj || null, endereco || null, telefone, email.toLowerCase(), contato_principal, devido, condicao.toUpperCase() || null]
    );
    await audit('FORNECEDORES', 'INSERT', r.lastID, null, { nome, email }, req.ip);
    ok(res, { msg: 'Fornecedor cadastrado com sucesso!', id: r.lastID }, 201);
}));

app.put('/fornecedores/:id', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const ant = await db.get('SELECT * FROM FORNECEDORES WHERE ID=?', [id]);
    if (!ant) return fail(res, 'Fornecedor não encontrado', 404);

    const nome = sanitize(req.body.nome || '') || ant.NOME_EMPRESA;
    const email = sanitize(req.body.email || '') || ant.EMAIL;
    const telefone = sanitize(req.body.telefone || '') || ant.TELEFONE;
    const contato_principal = sanitize(req.body.contato_principal || '') || ant.CONTATO_PRINCIPAL;
    const endereco = sanitize(req.body.endereco || '') || ant.ENDERECO;
    const condicao = sanitize(req.body.condicao || '') || ant.CONDICAO_PAGAMENTO;
    const cnpj = req.body.cnpj ? req.body.cnpj.replace(/\D/g, '') : ant.CNPJ;
    const devido = req.body.devido !== undefined ? parseFloat(req.body.devido) : ant.VALOR_DEVIDO;

    if (email && !validarEmail(email)) return fail(res, 'E-mail inválido');
    if (cnpj && cnpj !== ant.CNPJ && !validarCnpj(cnpj)) return fail(res, 'CNPJ inválido');

    await db.run(
        `UPDATE FORNECEDORES SET NOME_EMPRESA=?,CNPJ=?,ENDERECO=?,TELEFONE=?,EMAIL=?,
         CONTATO_PRINCIPAL=?,VALOR_DEVIDO=?,CONDICAO_PAGAMENTO=?,ATUALIZADO_EM=datetime('now','localtime') WHERE ID=?`,
        [nome.toUpperCase(), cnpj, endereco, telefone, email.toLowerCase(), contato_principal, devido, condicao.toUpperCase(), id]
    );
    await audit('FORNECEDORES', 'UPDATE', id, ant, req.body, req.ip);
    ok(res, { msg: 'Fornecedor atualizado com sucesso!' });
}));

app.delete('/fornecedores/:id', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const ant = await db.get('SELECT * FROM FORNECEDORES WHERE ID=?', [id]);
    if (!ant) return fail(res, 'Fornecedor não encontrado', 404);
    await db.run('UPDATE FORNECEDORES SET ATIVO=0 WHERE ID=?', [id]);
    await audit('FORNECEDORES', 'DELETE', id, ant, null, req.ip);
    ok(res, { msg: 'Fornecedor removido com sucesso!' });
}));

app.get('/clientes', wrap(async (req, res) => {
    ok(res, await db.all(
        `SELECT ID,NOME_COMPLETO,TELEFONE,EMAIL,ENDERECO,CONSENTIMENTO_LGPD,DATA_CONSENTIMENTO,
         ULTIMA_COMPRA_DATA,ULTIMA_COMPRA_VALOR FROM CLIENTES WHERE ATIVO=1 ORDER BY NOME_COMPLETO`
    ));
}));

app.post('/clientes', wrap(async (req, res) => {
    const nome = sanitize(req.body.nome || '');
    const tel = sanitize(req.body.tel || '');
    const email = sanitize(req.body.email || '');
    const endereco = sanitize(req.body.endereco || '');
    const cpf = req.body.cpf ? req.body.cpf.replace(/\D/g, '') : null;
    const consentimento_lgpd = req.body.consentimento_lgpd;

    if (!nome) return fail(res, 'Nome completo é obrigatório');
    if (!tel) return fail(res, 'Telefone é obrigatório');
    if (email && !validarEmail(email)) return fail(res, 'E-mail inválido');
    if (!consentimento_lgpd) return fail(res, 'O consentimento LGPD é obrigatório para o cadastro.');

    const cripto = cpf ? CryptoJS.AES.encrypt(cpf, SECRET_KEY).toString() : null;
    const r = await db.run(
        "INSERT INTO CLIENTES (NOME_COMPLETO,CPF_CRIPTO,TELEFONE,EMAIL,ENDERECO,CONSENTIMENTO_LGPD,DATA_CONSENTIMENTO) VALUES (?,?,?,?,?,1,datetime('now','localtime'))",
        [nome.toUpperCase(), cripto, tel, email.toLowerCase() || null, endereco || null]
    );
    await audit('CLIENTES', 'INSERT', r.lastID, null, { nome, tel, email }, req.ip);
    ok(res, { msg: 'Cliente cadastrado com sucesso!', id: r.lastID }, 201);
}));

app.put('/clientes/:id', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const ant = await db.get('SELECT * FROM CLIENTES WHERE ID=?', [id]);
    if (!ant) return fail(res, 'Cliente não encontrado', 404);

    const nome = sanitize(req.body.nome || '') || ant.NOME_COMPLETO;
    const tel = sanitize(req.body.tel || '') || ant.TELEFONE;
    const email = sanitize(req.body.email || '') || ant.EMAIL;
    const endereco = sanitize(req.body.endereco || '') || ant.ENDERECO;

    if (email && !validarEmail(email)) return fail(res, 'E-mail inválido');

    await db.run(
        'UPDATE CLIENTES SET NOME_COMPLETO=?,TELEFONE=?,EMAIL=?,ENDERECO=? WHERE ID=?',
        [nome.toUpperCase(), tel, email.toLowerCase(), endereco, id]
    );
    await audit('CLIENTES', 'UPDATE', id, { nome: ant.NOME_COMPLETO }, req.body, req.ip);
    ok(res, { msg: 'Cliente atualizado com sucesso!' });
}));

app.delete('/clientes/:id', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const ant = await db.get('SELECT * FROM CLIENTES WHERE ID=?', [id]);
    if (!ant) return fail(res, 'Cliente não encontrado', 404);
    await db.run('UPDATE CLIENTES SET ATIVO=0 WHERE ID=?', [id]);
    await audit('CLIENTES', 'DELETE', id, ant, null, req.ip);
    ok(res, { msg: 'Cliente removido com sucesso!' });
}));

app.delete('/clientes/:id/lgpd', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    await db.run(
        "UPDATE CLIENTES SET NOME_COMPLETO='[DADO REMOVIDO]',CPF_CRIPTO=NULL,TELEFONE=NULL,EMAIL=NULL,ENDERECO=NULL,ATIVO=0 WHERE ID=?",
        [id]
    );
    await audit('CLIENTES', 'LGPD_ESQUECIMENTO', id, null, null, req.ip);
    ok(res, { msg: 'Dados pessoais anonimizados conforme Art. 18 da LGPD.' });
}));

app.post('/associacao', wrap(async (req, res) => {
    const produto_id = parseInt(req.body.produto_id);
    const fornecedor_id = parseInt(req.body.fornecedor_id);
    if (!produto_id || !fornecedor_id) return fail(res, 'produto_id e fornecedor_id são obrigatórios');
    const existe = await db.get('SELECT ID FROM PRODUTO_FORNECEDOR WHERE PRODUTO_ID=? AND FORNECEDOR_ID=?', [produto_id, fornecedor_id]);
    if (existe) return fail(res, 'Fornecedor já está associado a este produto!', 409);
    await db.run('INSERT INTO PRODUTO_FORNECEDOR (PRODUTO_ID,FORNECEDOR_ID) VALUES (?,?)', [produto_id, fornecedor_id]);
    await audit('PRODUTO_FORNECEDOR', 'INSERT', null, null, { produto_id, fornecedor_id }, req.ip);
    ok(res, { msg: 'Fornecedor associado com sucesso ao produto!' }, 201);
}));

app.delete('/associacao', wrap(async (req, res) => {
    const produto_id = parseInt(req.body.produto_id);
    const fornecedor_id = parseInt(req.body.fornecedor_id);
    if (!produto_id || !fornecedor_id) return fail(res, 'produto_id e fornecedor_id são obrigatórios');
    await db.run('DELETE FROM PRODUTO_FORNECEDOR WHERE PRODUTO_ID=? AND FORNECEDOR_ID=?', [produto_id, fornecedor_id]);
    await audit('PRODUTO_FORNECEDOR', 'DELETE', null, { produto_id, fornecedor_id }, null, req.ip);
    ok(res, { msg: 'Fornecedor desassociado com sucesso!' });
}));

app.get('/vendas', wrap(async (req, res) => {
    ok(res, await db.all(`
        SELECT V.*,P.NOME_PRODUTO,C.NOME_COMPLETO CLIENTE_NOME FROM VENDAS V
        LEFT JOIN PRODUTOS P ON V.PRODUTO_ID=P.ID LEFT JOIN CLIENTES C ON V.CLIENTE_ID=C.ID
        ORDER BY V.ID DESC LIMIT 50
    `));
}));

app.post('/vendas', wrap(async (req, res) => {
    const produto_id = parseInt(req.body.produto_id);
    const quantidade = parseInt(req.body.quantidade);
    const cliente_id = req.body.cliente_id ? parseInt(req.body.cliente_id) : null;
    const forma_pagamento = sanitize(String(req.body.forma_pagamento || 'DINHEIRO')).toUpperCase();
    const pago = req.body.pago === undefined ? 1 : (req.body.pago ? 1 : 0);
    const data_vencimento = sanitize(req.body.data_vencimento || '');

    if (!produto_id) return fail(res, 'produto_id é obrigatório');
    if (!quantidade || quantidade <= 0) return fail(res, 'Quantidade inválida');

    const prod = await db.get('SELECT * FROM PRODUTOS WHERE ID=? AND ATIVO=1', [produto_id]);
    if (!prod) return fail(res, 'Produto não encontrado', 404);
    if (prod.QUANTIDADE < quantidade) return fail(res, `Estoque insuficiente. Disponível: ${prod.QUANTIDADE}`);

    const desconto = FORMAS_DESCONTO.includes(forma_pagamento) ? TAXA_DESCONTO : 0;
    const precoFinal = prod.PRECO * (1 - desconto);
    const total = precoFinal * quantidade;

    const r = await db.run(
        'INSERT INTO VENDAS (CLIENTE_ID,PRODUTO_ID,QUANTIDADE,PRECO_UNITARIO,DESCONTO_PERCENTUAL,TOTAL,FORMA_PAGAMENTO,PAGO,DATA_VENCIMENTO) VALUES (?,?,?,?,?,?,?,?,?)',
        [cliente_id, produto_id, quantidade, precoFinal, desconto * 100, total, forma_pagamento, pago, data_vencimento || null]
    );
    await db.run('UPDATE PRODUTOS SET QUANTIDADE=QUANTIDADE-? WHERE ID=?', [quantidade, produto_id]);
    if (cliente_id) {
        await db.run("UPDATE CLIENTES SET ULTIMA_COMPRA_DATA=datetime('now','localtime'),ULTIMA_COMPRA_VALOR=? WHERE ID=?", [total, cliente_id]);
    }
    await audit('VENDAS', 'INSERT', r.lastID, null, req.body, req.ip);
    ok(res, { msg: 'Venda registrada!', id: r.lastID, total, desconto_aplicado: desconto > 0 }, 201);
}));

app.patch('/vendas/:id/pagar', wrap(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return fail(res, 'ID inválido', 400);
    const venda = await db.get('SELECT * FROM VENDAS WHERE ID=?', [id]);
    if (!venda) return fail(res, 'Venda não encontrada', 404);
    if (venda.PAGO) return fail(res, 'Esta venda já está quitada');
    await db.run("UPDATE VENDAS SET PAGO=1,DATA_PAGAMENTO=datetime('now','localtime') WHERE ID=?", [id]);
    await audit('VENDAS', 'PAGAR', id, venda, null, req.ip);
    ok(res, { msg: 'Recebimento registrado com sucesso!' });
}));

app.use((error, req, res, _next) => {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
});

initDb()
    .then(() => app.listen(PORT, () => console.log(`\n✅  Old School Garage API rodando em http://localhost:${PORT}\n`)))
    .catch(e => { console.error('Falha ao inicializar banco:', e); process.exit(1); });