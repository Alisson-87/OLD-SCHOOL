# Old School Garage — Sistema de Gestão Full-Stack

## 🌐 API Online — Replit

A API está disponível publicamente em:

**https://995538a8-a251-492f-a1b3-63a13300100f-00-3j44c1nby0ea.spock.replit.dev**

Credenciais de acesso ao sistema:
- **E-mail:** dom@torettodragrace.com
- **Senha:** admin123

Ou para o tutor:
- **E-mail:** tutor@grancursos.com  
- **Senha:** tutor123

**Versão:** 2.0.0
**Disciplina:** Projeto Integrador — Desenvolvimento Full-Stack
**Instituição:** Gran Faculdade

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Arquitetura e Tecnologias](#arquitetura-e-tecnologias)
3. [Funcionalidades](#funcionalidades)
4. [Segurança e Conformidade LGPD](#segurança-e-conformidade-lgpd)
5. [Modelagem do Banco de Dados](#modelagem-do-banco-de-dados)
6. [Instalação e Execução](#instalação-e-execução)
7. [Rotas da API](#rotas-da-api)
8. [Credenciais de Avaliação](#credenciais-de-avaliação)

---

## Visão Geral

O **Old School Garage** é um sistema de gestão comercial e controle de estoque desenvolvido como Projeto Integrador do curso de Desenvolvimento Full-Stack. A aplicação é dividida em dois módulos independentes: uma **API RESTful** (backend) e uma **interface de usuário** (frontend), comunicando-se via requisições HTTP assíncronas com autenticação JWT.

O sistema foi projetado com foco em segurança da informação conforme a **ABNT NBR ISO/IEC 27001** e total conformidade com a **Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018)**.

---

## Arquitetura e Tecnologias

### Backend — API RESTful

| Tecnologia | Finalidade |
|---|---|
| Node.js | Ambiente de execução JavaScript server-side |
| Express.js | Framework para roteamento e middlewares HTTP |
| SQLite3 + sqlite | Banco de dados relacional embarcado |
| bcrypt | Hash seguro de senhas (salt rounds: 12) |
| jsonwebtoken | Autenticação stateless via token JWT (8h) |
| crypto-js | Criptografia AES para dados sensíveis (CPF) |
| helmet | Headers HTTP de segurança |
| cors | Controle de política de mesma origem |
| express-rate-limit | Limitação de requisições por IP |

### Frontend — Interface do Usuário

| Tecnologia | Finalidade |
|---|---|
| React 18 | Biblioteca de construção de interfaces |
| axios | Cliente HTTP com interceptors para JWT |
| jsPDF + jspdf-autotable | Geração de orçamentos em PDF |
| lucide-react | Biblioteca de ícones |

---

## Funcionalidades

### Autenticação
- Cadastro de usuário com nome, e-mail e senha
- Senhas armazenadas com hash bcrypt (salt automático, 12 rounds)
- Login com geração de token JWT (expiração em 8 horas)
- Rate limit exclusivo para rotas de autenticação (20 tentativas/15 min)
- Todas as rotas protegidas por middleware de verificação JWT
- Logout com remoção do token do armazenamento local
- Exibição do nome e e-mail do usuário logado na barra lateral

### Painel (Dashboard)
- 6 KPIs em tempo real: produtos, fornecedores, clientes, total em vendas, total a pagar e total a receber
- Alerta visual de estoque baixo (produtos com 5 ou menos unidades)
- Painel de Contas a Pagar com botão de pagamento direto
- Painel de Contas a Receber com botão de recebimento direto
- Indicação visual de vencimentos atrasados
- Histórico das últimas 5 vendas com status de pagamento

### Gestão de Produtos
- Cadastro com código de barras (único), categoria, descrição e data de validade
- Busca em tempo real por nome ou código de barras
- Indicador de estoque colorido: verde (normal), amarelo (≤15), vermelho (≤5)
- Registro de entrada de estoque com débito automático ao fornecedor
- Exclusão lógica preservando histórico de vendas

### Gestão de Fornecedores
- Cadastro completo com validação de CNPJ (algoritmo dos dígitos verificadores)
- Saldo devedor atualizado automaticamente via entradas de estoque
- Baixa de pagamento com abatimento automático do saldo
- Indicador visual de débito (vermelho) ou zerado (verde)

### Gestão de Clientes
- Cadastro com CPF armazenado sob criptografia AES
- Modal de consentimento LGPD obrigatório no primeiro cadastro
- Direito ao esquecimento com anonimização permanente dos dados
- Histórico automático de última compra e valor

### Associação Produto / Fornecedor
- Relação muitos-para-muitos entre produtos e fornecedores
- Associação e desassociação com validação de duplicidade
- Detalhes do produto exibidos ao selecionar

### PDV — Ponto de Venda
- Múltiplos itens por venda em uma única operação
- Desconto automático de 10% para pagamentos em Dinheiro ou PIX
- Desconto exibido com destaque no resumo e no PDF gerado
- Suporte a 7 formas de pagamento
- Controle de pagamento à vista ou a prazo com data de vencimento
- Geração de orçamento em PDF com layout profissional e logo

---

## Segurança e Conformidade LGPD

| Requisito | Implementação |
|---|---|
| Autenticação | Senhas com bcrypt (12 rounds) + JWT com expiração de 8h |
| Proteção de rotas | Middleware JWT em 100% das rotas após `/auth/*` |
| Brute force | Rate limit exclusivo nas rotas de autenticação (20 req/15min) |
| Rate limit global | 500 requisições por IP a cada 15 minutos |
| Headers de segurança | helmet aplicado em todos os endpoints |
| CPF criptografado | Armazenado como cipher AES — nunca em texto puro |
| CPF não exposto | Nenhuma listagem retorna o campo CPF_CRIPTO (Art. 6, LGPD) |
| Consentimento explícito | Modal obrigatório com texto da lei no cadastro de clientes (Art. 7, I) |
| Trilha de auditoria | Tabela AUDITORIA com IP de origem em toda operação (Art. 37) |
| Direito ao esquecimento | Rota de anonimização permanente dos dados pessoais (Art. 18, VI) |
| Exclusão lógica | Campo ATIVO=0 preserva integridade do histórico |
| Sanitização de entrada | Remoção de `<>"'\`` em todos os campos antes da persistência |
| Validação de e-mail | Regex em todas as rotas que recebem e-mail |
| Validação de CNPJ | Algoritmo completo dos dígitos verificadores |
| SQL Injection | Uso exclusivo de prepared statements parametrizados |
| Integridade do banco | `PRAGMA foreign_keys = ON` e `PRAGMA journal_mode = WAL` |
| CORS restrito | Origem configurável via variável de ambiente `ORIGIN` |

---

## Modelagem do Banco de Dados

```
USUARIOS              CLIENTES              FORNECEDORES
────────              ────────              ────────────
ID (PK)               ID (PK)               ID (PK)
NOME                  NOME_COMPLETO         NOME_EMPRESA
EMAIL (unique)        CPF_CRIPTO (AES)      CNPJ (unique)
SENHA_HASH (bcrypt)   TELEFONE              ENDERECO
CRIADO_EM             EMAIL                 TELEFONE
                      ENDERECO              EMAIL
                      CONSENTIMENTO_LGPD    CONTATO_PRINCIPAL
                      DATA_CONSENTIMENTO    VALOR_DEVIDO
                      ULTIMA_COMPRA_DATA    CONDICAO_PAGAMENTO
                      ULTIMA_COMPRA_VALOR   ATIVO
                      ATIVO                 CRIADO_EM / ATUALIZADO_EM
                      CRIADO_EM

PRODUTOS                        PRODUTO_FORNECEDOR
────────                        ──────────────────
ID (PK)                         ID (PK)
NOME_PRODUTO                    PRODUTO_ID → PRODUTOS
CODIGO_BARRAS (unique)          FORNECEDOR_ID → FORNECEDORES
DESCRICAO                       CRIADO_EM
QUANTIDADE                      UNIQUE (PRODUTO_ID, FORNECEDOR_ID)
PRECO
CATEGORIA
DATA_VALIDADE
FORNECEDOR_ID → FORNECEDORES
ATIVO
CRIADO_EM / ATUALIZADO_EM

ENTRADAS                        VENDAS                      AUDITORIA
────────                        ──────                      ─────────
ID (PK)                         ID (PK)                     ID (PK)
PRODUTO_ID → PRODUTOS           CLIENTE_ID → CLIENTES       TABELA
FORNECEDOR_ID → FORNECEDORES    PRODUTO_ID → PRODUTOS       OPERACAO
QUANTIDADE                      QUANTIDADE                  REGISTRO_ID
PRECO_UNITARIO                  PRECO_UNITARIO              DADOS_ANTERIORES
TOTAL                           DESCONTO_PERCENTUAL         DADOS_NOVOS
DATA_VENCIMENTO                 TOTAL                       IP_ORIGEM
PAGO                            FORMA_PAGAMENTO             CRIADO_EM
DATA_PAGAMENTO                  PAGO
CRIADO_EM                       DATA_VENCIMENTO
                                DATA_PAGAMENTO
                                CRIADO_EM
```

---

## Instalação e Execução

O projeto requer dois terminais abertos simultaneamente.

### Pré-requisitos

- Node.js v18 ou superior (recomendado LTS)
- npm v9 ou superior

### 1. Backend

```bash
cd backend
npm install
node server.js
```

> A API ficará disponível em `http://localhost:3000`.
> O arquivo `database.db` é criado automaticamente na primeira execução.

Instale as dependências do backend:

```bash
npm install express sqlite sqlite3 cors helmet crypto-js express-rate-limit bcrypt jsonwebtoken
```

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

> A interface ficará disponível em `http://localhost:3001`.

Instale as dependências do frontend:

```bash
npm install axios jspdf jspdf-autotable lucide-react
```

---

## Rotas da API

Todas as rotas (exceto `/auth/*`) exigem o header:

```
Authorization: Bearer <token>
```

### Autenticação (públicas)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cadastro de novo usuário |
| POST | `/auth/login` | Login e geração de token JWT |

### Dashboard

| Método | Rota | Descrição |
|---|---|---|
| GET | `/dashboard` | KPIs, alertas, contas e últimas vendas |

### Produtos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/produtos` | Listar (`?search=` e `?page=`) |
| GET | `/produtos/:id` | Detalhe com fornecedores associados |
| POST | `/produtos` | Cadastrar |
| PUT | `/produtos/:id` | Atualizar |
| DELETE | `/produtos/:id` | Exclusão lógica |

### Fornecedores

| Método | Rota | Descrição |
|---|---|---|
| GET | `/fornecedores` | Listar ativos |
| POST | `/fornecedores` | Cadastrar |
| PUT | `/fornecedores/:id` | Atualizar |
| DELETE | `/fornecedores/:id` | Exclusão lógica |

### Clientes

| Método | Rota | Descrição |
|---|---|---|
| GET | `/clientes` | Listar (CPF nunca retornado) |
| POST | `/clientes` | Cadastrar (exige consentimento LGPD) |
| PUT | `/clientes/:id` | Atualizar |
| DELETE | `/clientes/:id` | Exclusão lógica |
| DELETE | `/clientes/:id/lgpd` | Anonimização permanente (Art. 18) |

### Entradas de Estoque

| Método | Rota | Descrição |
|---|---|---|
| GET | `/entradas` | Listar entradas |
| POST | `/entradas` | Registrar (atualiza estoque + débito ao fornecedor) |
| PATCH | `/entradas/:id/pagar` | Registrar pagamento ao fornecedor |

### Vendas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/vendas` | Listar recentes |
| POST | `/vendas` | Registrar (aplica desconto 10% Dinheiro/PIX) |
| PATCH | `/vendas/:id/pagar` | Registrar recebimento |

### Associações

| Método | Rota | Descrição |
|---|---|---|
| POST | `/associacao` | Associar fornecedor a produto |
| DELETE | `/associacao` | Desassociar fornecedor de produto |

---

## Credenciais de Avaliação

O sistema não possui usuário padrão pré-cadastrado, garantindo que o fluxo completo de autenticação seja avaliado. Para acessar:

1. Acesse `http://localhost:3001`
2. Clique em **"Criar Conta"** na tela de login
3. Preencha nome, e-mail e senha (mínimo 6 caracteres)
4. Após criar a conta, faça login com as credenciais cadastradas

O tutor pode criar quantas contas quiser para testar o sistema.

---

*Projeto desenvolvido para fins acadêmicos — Gran Faculdade — Projeto Integrador Full-Stack.*