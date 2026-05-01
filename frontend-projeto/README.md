# 🛠️ Old School Garage — Sistema de Gestão Full-Stack (v2.0.0)

Um sistema completo (Full-Stack) desenvolvido para o controle de estoque e gestão comercial. O projeto é dividido em uma API RESTful robusta e uma interface de usuário interativa, projetado com foco rigoroso em segurança da informação (ABNT NBR ISO/IEC 27001) e total conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).

## 📌 Arquitetura e Tecnologias

### ⚙️ Backend (API REST)
Estruturado em **Node.js** utilizando o framework **Express**[cite: 1], com persistência de dados em um banco de dados relacional **SQLite**[cite: 1].
- **Banco de Dados:** SQLite3 (com `PRAGMA foreign_keys = ON` para garantia de integridade referencial)[cite: 1].
- **Criptografia:** Crypto-js (Padrão AES)[cite: 1].
- **Segurança e Middlewares:** Helmet, CORS, Express Rate Limit[cite: 1].

### 🖥️ Frontend (Interface do Usuário)
Desenvolvido em **React**, inicializado através do [Create React App](https://github.com/facebook/create-react-app).
- **Gerenciamento de Estado e Componentização:** React puro.
- **Integração:** Consumo da API RESTful via rotas assíncronas.

---

## 🛡️ Segurança da Informação e Conformidade (LGPD)
O backend foi desenhado com princípios de *Privacy by Design*:
- **Proteção de Dados Sensíveis:** O CPF dos clientes é salvo no banco de dados sob criptografia AES (`CPF_CRIPTO`)[cite: 1].
- **Trilha de Auditoria (Art. 37, LGPD):** Tabela exclusiva (`AUDITORIA`) que registra operações de `INSERT`, `UPDATE` e `DELETE`, capturando o IP de origem[cite: 1].
- **Consentimento Explícito (Art. 7, LGPD):** Validação obrigatória do consentimento durante o cadastro de novos clientes[cite: 1].
- **Direito ao Esquecimento (Art. 18, LGPD):** Rota específica de exclusão lógica que realiza a anonimização dos dados pessoais do cliente[cite: 1].
- **Prevenção contra Ataques:** Utilização de `helmet` e `rate-limit` (máximo de 300 requisições/15 min) para prevenir sobrecarga e ataques de força bruta[cite: 1].

---

## 🗄️ Modelagem do Banco de Dados
A API gerencia as seguintes entidades principais[cite: 1]:
- **FORNECEDORES:** Controle de credores, com exclusão lógica (`ATIVO = 0`).
- **PRODUTOS:** Controle de estoque validado e associado a fornecedores.
- **CLIENTES:** Gestão de consumidores com métricas automáticas.
- **VENDAS:** Registro transacional que debita automaticamente o estoque.

---

## 🚀 Como Executar o Projeto Localmente

Como o projeto é Full-Stack, você precisará rodar o Backend e o Frontend em terminais separados.

### 1. Rodando o Backend (API)
Abra um terminal na pasta raiz do projeto:
\`\`\`bash
# Instale as dependências da API
npm install

# Inicie o servidor
node app.js
\`\`\`
> A API estará escutando as requisições em `http://localhost:3000`[cite: 1]. O banco de dados `database.db` será gerado automaticamente na primeira execução[cite: 1].

### 2. Rodando o Frontend (React)
Abra um **segundo terminal** na pasta do frontend (ex: `frontend-projeto`):
\`\`\`bash
# Instale as dependências da interface
npm install

# Inicie a aplicação React
npm start
\`\`\`
> O frontend rodará no modo de desenvolvimento. Abra [http://localhost:3001](http://localhost:3001) para visualizá-lo no navegador (a API está configurada para aceitar requisições desta porta via CORS)[cite: 1].

---

## 📜 Scripts Adicionais do Frontend (Create React App)

Na pasta do frontend, você também pode executar:
- `npm test`: Inicia o test runner no modo interativo.
- `npm run build`: Compila o app para produção na pasta `build`, otimizando e minificando os arquivos para a melhor performance.
- `npm run eject`: *Aviso: Operação irreversível.* Remove a dependência de build única e copia as configurações para controle total.

Para aprender mais, consulte a [Documentação do React](https://reactjs.org/) e do [Create React App](https://facebook.github.io/create-react-app/docs/getting-started).