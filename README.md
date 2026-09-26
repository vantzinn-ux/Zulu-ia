# Zulu V5.0.0

Atualização consolidada do chat, com a autenticação Supabase e o banco existentes.
Comece por **LEIA-ME-PRIMEIRO.txt** para atualizar no GitHub/Render.

## O que foi reunido

| Pacote recebido | Uso nesta versão |
| --- | --- |
| ZULU_RENDER_V3_COMPLETO | Comparado; foi substituído pela arquitetura de contas da V4. O backend antigo não foi reintroduzido. |
| ZULU_V4_AUTH_COMPLETA | Base de autenticação, configurações, memória, avatar e dependências originais. |
| ZULU_V4_LOGIN_HOTFIX_4_0_1 | Base do frontend com a correção de carregamento do Supabase. |
| ZULU_V4_SERVER_URL_HOTFIX | Normalização de SUPABASE_URL, já presente na 4.0.3. |
| ZULU_V4_ACCOUNT_HOTFIX_4_0_2 | Criação de perfil/configurações ausentes, já presente na 4.0.3. |
| ZULU_V4_MEMORY_FIX_4_0_3 | Servidor mais recente; mantém user_id explícito ao salvar memórias. |

Os anexos repetidos tinham o mesmo caminho materializado. Foram analisados os seis ZIPs distintos disponíveis, seus conteúdos e a sequência de correções. Os SQLs históricos foram preservados, sem alterações, em `docs/sql-original/`.

## Chat e aparência

- Menu persistente no desktop e recolhível no celular, busca no histórico, nova conversa e exportação.
- Nome e avatar da assistente somente no menu; mensagens sem avatar repetido e cabeçalho com título da conversa.
- Temas claro/escuro, contraste de código, tabelas com rolagem, layout para respostas longas.
- Streaming real do provedor, efeito de digitação, interrupção, tratamento de erro e restauração do pedido para tentar novamente.
- Respeita a preferência de movimento reduzido do aparelho. `Enter` envia no computador; `Shift+Enter` insere linha. No celular, o teclado permite quebrar linhas e o botão envia.
- Botão Copiar nos blocos e na resposta inteira; download individual e ZIP. Texto normal continua selecionável.
- Quando o limite de geração é atingido, a resposta é marcada como parcial e oferece Continuar; downloads de código parcial ficam indisponíveis até obter um arquivo completo. A marcação é mantida ao reabrir a conversa.

A instrução da assistente evita apresentações repetitivas e menções espontâneas à empresa/criador. O tom acompanha o idioma, a formalidade e emoções expressas pelo usuário, sem presumir pensamentos nem forçar entusiasmo. O comportamento linguístico final depende do modelo configurado.

## Arquivos aceitos

| Entrada | Como é lida |
| --- | --- |
| PNG, JPEG, WebP | Bytes originais enviados ao modelo multimodal. |
| PDF | Documento enviado ao modelo, incluindo páginas visuais. |
| DOCX | Texto extraído; imagens e diagramação do Word não são analisadas. Para isso, envie PDF. |
| TXT, MD, CSV, JSON, XML, YAML e similares | Texto UTF-8 ou UTF-16. |
| JS, TS, HTML, CSS, Python, Lua, SQL, Java, C/C++, C#, Go, Rust, PHP, shell, AHK e outros fontes comuns | Conteúdo textual completo dentro dos limites. |
| ZIP | Fontes/textos extraídos em memória; a IA recebe o nome e conteúdo de cada arquivo aceito e a lista do que foi omitido. |

6 anexos por mensagem, 5 MB por arquivo e 10 MB somados. Até 400 mil caracteres extraídos por envio. ZIPs aceitam até 400 entradas e 20 MB descompactados. Pastas `node_modules`, `.git`, `dist`, `build`, `vendor` e `__pycache__`, arquivos binários e ZIPs internos não são analisados. ZIPs com senha, caminhos inseguros e arquivos incompatíveis retornam erro claro. Não há truncamento silencioso de arquivos de texto grandes.

Arquivos gerados para baixar são texto/código, como `.lua`, `.js`, `.py`, `.html`, `.json`, `.csv`, `.md`, `.txt`, e ZIP desses arquivos. Não há geração de PDF, DOCX, XLSX, imagens, executáveis nem edição de binários. A assistente recebeu instruções para explicar essa limitação em vez de inventar links ou prometer arquivos inexistentes.

## Como os downloads são gerados

O servidor instrui o modelo a entregar cada arquivo em um bloco Markdown com linguagem e nome:

~~~~markdown
```javascript filename=src/app.js
console.log("Olá!");
```
~~~~

A interface transforma o bloco em código formatado, botão Copiar e arquivo baixável. Vários blocos podem ser reunidos em ZIP. Os caminhos de pastas são preservados no ZIP; no download individual, o navegador usa o nome final. Blocos de código sem nome também podem ser baixados com um nome automático.

Para uma mensagem pronta, o modelo usa `text filename=mensagem.txt`. O botão Copiar entrega apenas o conteúdo do bloco. O botão Copiar resposta preserva o Markdown completo.

## Conta, histórico e banco

Não há tabelas, colunas, buckets, novas chaves ou migrações nesta atualização. O projeto pressupõe o Supabase da V4 já funcionando. Os arquivos recebidos não incluíam o esquema inicial completo para provisionar uma conta Supabase do zero.

Os endpoints de conta, validação de sessão, perfil, configurações e extração de memória mantêm as rotinas da 4.0.3. O frontend usa o SDK instalado no projeto, sem depender do CDN para abrir o login. O callback de sessão agenda o carregamento da conta fora do bloqueio interno do SDK e evita recarregar o chat a cada renovação de token. Login, cadastro, OTP, recuperação, OAuth e as credenciais continuam com os mesmos métodos e configurações.

Anexos e texto são serializados dentro do campo **content** já existente em **messages**. Assim, permanecem vinculados ao usuário/chat, disponíveis depois de recarregar e em outros dispositivos da mesma conta. Mensagens antigas em texto simples continuam legíveis. Não é criado armazenamento público nem diretório de uploads; arquivos enviados não são executados.

**Esse método ocupa espaço no banco**: os originais são guardados em base64, que aumenta o tamanho aproximadamente em um terço, junto com o texto extraído quando aplicável. Ele atende ao pedido de não alterar a estrutura SQL; para uso intenso com muitos arquivos, uma evolução futura pode separar anexos em armazenamento privado.

O histórico carrega as 20 mensagens mais recentes, com botão para carregar anteriores. O contexto enviado à IA usa até 24 mensagens recentes, limitado a cerca de 18 MiB de conteúdo armazenado. Conversas muito grandes não cabem integralmente no contexto: a assistente recebe uma indicação quando anexos antigos ficam de fora e deve pedir reenvio se necessário. Memórias continuam separadas por conta; o extrator recebe a mensagem digitada, sem extrair automaticamente código e segredos dos anexos.

## Instalação

No Render já utilizado:

1. Envie os arquivos deste pacote para a raiz do repositório, mantendo a pasta `lib/`.
2. Inclua `package-lock.json`. Use Build Command `npm ci` e Start Command `npm start`.
3. Mantenha as variáveis `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` e a versão Node 22 já usada. São aceitos Node 22 e 24.
4. Faça o deploy e atualize o navegador. `/api/health` deverá retornar `version: "5.0.0"`.
5. Não rode os SQLs históricos para esta atualização e não substitua suas variáveis pelos exemplos.

Para executar localmente com as mesmas credenciais em um `.env` privado:

```sh
npm ci
npm start
```

Acesse `http://localhost:3000`. As configurações externas de OAuth e e-mail permanecem as do seu Supabase. Login social local depende das URLs de redirecionamento já autorizadas nessa conta.

Variáveis opcionais:

| Nome | Padrão e função |
| --- | --- |
| GEMINI_MAX_OUTPUT_TOKENS | 32768; pode variar entre 1024 e 65536, respeitando o modelo. |
| ALLOWED_ORIGINS | Origens adicionais separadas por vírgula, para outro app/domínio. A própria origem e o domínio original já são aceitos. |
| TRUST_PROXY | Número de proxies confiáveis. No Render, assume 1 ao detectar a variável RENDER. |
| PORT | 3000, ou a porta fornecida pela hospedagem. |

O modelo padrão mantém `gemini-3.5-flash-lite`, como nos seus arquivos. Uma variável GEMINI_MODEL já configurada tem prioridade. A chave precisa ter acesso ao modelo escolhido, com cota para texto, imagens e PDFs. Os limites de custo e uso do serviço continuam valendo. Nenhuma chave real é incluída neste pacote.

## Verificação depois do deploy

- Entre com uma conta que você já usava e confira histórico/nome/tema.
- Envie um print legível e pergunte sobre o problema na imagem.
- Anexe um pequeno `.lua`, `.js`, PDF, DOCX ou ZIP sem dependências.
- Peça dois arquivos completos; confira Copiar, Baixar e Baixar tudo em ZIP.
- Envie um comunicado longo para reformular e confira o bloco de texto pronto.
- Teste Interromper e reabra o chat para conferir o que foi salvo. Uma interrupção antes da gravação mantém o pedido no campo para reenviar; não promete salvar resposta parcial.
- Pergunte sobre criador/empresa e compare com uma conversa comum, em que eles não devem ser mencionados espontaneamente.

Em caso de erro da IA, a interface distingue cota, modelo ausente, chave sem acesso, anexo incompatível e falha ao concluir/salvar. Os erros não expõem a chave. No servidor, verifique os logs do Render. Contas ou políticas RLS existentes não foram modificadas.

## Testes e estrutura

`npm test` executa os 12 testes Node incluídos. Leia `docs/VALIDACAO.md` para o que foi e não foi verificado. As imagens em `docs/previas/` mostram a interface com conteúdo simulado de teste.

- `server.js`: aplicação Express e rotas existentes de conta/histórico/memória.
- `lib/chat-route.js`: processamento autenticado, streaming e gravação de mensagens.
- `lib/gemini.js`: integração de texto e streaming com a API já usada.
- `lib/attachments.js`: validação, extração e contexto multimodal.
- `lib/prompt.js`: comportamento da assistente e convenção dos arquivos gerados.
- `index.html`, `style.css`, `app.js`, `chat-ui.js`: interface e fluxo de conta.
- `package.json`, `package-lock.json`: versões e dependências reproduzíveis.

Somente os arquivos públicos necessários e as bibliotecas de navegador são servidos. Código do servidor, SQLs, `.env` e configurações privadas não são disponibilizados como arquivos estáticos.

Referências técnicas consultadas: [geração e streaming Gemini](https://ai.google.dev/api/generate-content), [entrada de imagens](https://ai.google.dev/gemini-api/docs/image-understanding), [modelo configurado](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [leitura ZIP com yauzl](https://github.com/thejoshwolfe/yauzl).
