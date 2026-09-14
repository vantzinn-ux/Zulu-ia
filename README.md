# Zulu — V&D Digital

Versão preparada para upload pelo celular no GitHub.

Todos os arquivos ficam na raiz do repositório para facilitar o envio mobile.

## Não envie sua chave Gemini ao GitHub
A chave será adicionada depois nas variáveis de ambiente da hospedagem.

## Arquivos
- server.js — servidor/API
- db.js — memória e histórico SQLite
- index.html / style.css / app.js — interface web
- package.json — dependências
- .env.example — exemplo de configuração

## Inicialização
`npm install`
`npm start`

A hospedagem deve definir:
- GEMINI_API_KEY
- GEMINI_MODEL=gemini-3.5-flash-lite
