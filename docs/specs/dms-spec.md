# Especificação - Document Management System

> Especificação do MVP do Document Management System (DMS). O contrato abaixo está implementado; `X-User-Id` permanece uma identidade de demonstração, não uma autenticação.

## 1. Objetivo

Permitir que cada usuário envie, liste e baixe seus documentos, mantendo os arquivos no filesystem local da aplicação e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos associados ao identificador de usuário enviado na requisição.
- Download de um documento pertencente ao usuário identificado na requisição.
- Identificação simples do proprietário por meio do header `X-User-Id`.
- Armazenamento de arquivos em `backend/storage` com Multer e `diskStorage`.
- Metadados mantidos em memória durante a execução do processo.
- Interface web para enviar, listar e baixar documentos por meio da API.

### Fora do escopo

- Autenticação ou autorização robusta: `X-User-Id` é um identificador declarado pelo cliente e não prova a identidade do usuário.
- Banco de dados ou persistência durável dos metadados.
- Armazenamento em nuvem, provedores externos ou serviços de upload de terceiros.
- Exclusão, edição, versionamento, compartilhamento ou busca avançada de documentos.
- Paginação da listagem no MVP.
- Verificação antimalware ou garantia de que o conteúdo do arquivo é seguro.

### Premissas e limitações

- O header `X-User-Id` deve estar presente e não pode ser vazio após remoção de espaços em branco. A aplicação usa esse valor para associar e filtrar documentos, sem considerá-lo uma credencial.
- Após reiniciar o backend, os metadados em memória são perdidos. Os arquivos no disco podem continuar em `backend/storage`, mas não estarão disponíveis pela API sem seus metadados; limpeza e recuperação desses arquivos não fazem parte do MVP.
- A aplicação não deve aceitar do cliente caminhos locais ou nomes de armazenamento. O nome físico do arquivo deve ser gerado pela aplicação e não derivado como caminho do nome original.
- O limite atual é por arquivo; não há quota total de storage, limite por usuário confiável ou rate limiting. A aplicação não deve ser exposta a clientes não confiáveis antes de definir e implementar esses controles.
- A extensão, o MIME e a assinatura básica do conteúdo são verificados para identificar formatos incompatíveis. Isso não substitui análise antimalware nem torna os arquivos seguros.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O usuário pode enviar um documento. | `POST /upload` recebe um arquivo no campo `file`, exige `X-User-Id` e aceita somente PDF, DOC, DOCX ou TXT de até 10 MiB. |
| RF-02 | O sistema armazena o arquivo localmente. | O arquivo é gravado em `backend/storage` por Multer `diskStorage`, com nome físico único gerado pelo servidor. |
| RF-03 | O sistema registra os metadados do documento. | Após upload bem-sucedido, os metadados ficam disponíveis em memória e incluem um identificador único e o proprietário. |
| RF-04 | O usuário pode listar seus documentos. | `GET /documents` retorna somente documentos cujo `owner` corresponde ao `X-User-Id` recebido; uma lista vazia é uma resposta válida. |
| RF-05 | O usuário pode baixar um documento próprio por identificador. | `GET /documents/:id/download` transmite o arquivo como anexo somente quando o documento pertence ao `X-User-Id` recebido. |
| RF-06 | O sistema trata entradas inválidas de forma previsível. | Ausência de usuário ou arquivo, tipo não aceito, tamanho excedido e documento indisponível resultam nos status e formatos definidos nos contratos de API. |
| RF-07 | A interface permite operar o fluxo principal. | O usuário pode enviar um documento, ver sua listagem atualizada e iniciar o download de um item listado; falhas da API são apresentadas sem perder a possibilidade de tentar novamente. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos enviados devem ser gravados exclusivamente no filesystem local da aplicação, em `backend/storage`, usando Multer com `diskStorage`. Não usar armazenamento externo. |
| RNF-02 | Os metadados dos documentos devem permanecer em memória nesta fase. Reiniciar o processo não deve ser descrito como preservando a listagem. |
| RNF-03 | Cada arquivo deve ter no máximo 10 MiB (10 × 1024 × 1024 bytes). O backend deve aplicar o limite durante o processamento do upload. |
| RNF-04 | Os formatos permitidos são PDF, DOC, DOCX e TXT. O backend deve comparar extensão e MIME informado e validar assinatura/conteúdo básico (PDF, OLE para DOC, pacote OOXML para DOCX e UTF-8 sem NUL para TXT). Essa validação não substitui análise antimalware. |
| RNF-05 | O identificador do documento e o nome físico de armazenamento devem ser gerados pelo servidor e não devem colidir com arquivos existentes. O caminho resolvido precisa permanecer dentro de `backend/storage`. |
| RNF-06 | A listagem e o download devem aplicar o filtro por proprietário no backend. Para não revelar a existência de documentos de terceiros, documento inexistente e documento de outro proprietário devem ter a mesma resposta `404`. |
| RNF-07 | O backend deve tratar erros de upload e de filesystem no limite HTTP, sem expor stack traces, caminhos internos ou detalhes do filesystem nas respostas ao cliente. |
| RNF-08 | Configurações de execução devem usar variáveis de ambiente quando configuráveis. A porta do backend usa `PORT` e, na ausência dela, o valor padrão atual é `3000`. O destino atual do proxy Vite é `http://localhost:3000`. |
| RNF-09 | Os testes do backend devem usar o runner nativo `node:test`. O frontend deve ser compilável pelo comando `npm run build` do pacote frontend. |
| RNF-10 | O fluxo de desenvolvimento local deve usar o proxy Vite para chamadas do frontend, sem exigir configuração de CORS para a comunicação feita por esse proxy. |

## 5. Modelo de dados

### Metadados do documento

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string | Sim | Identificador único, opaco e gerado pelo servidor. Usado na rota de download. |
| `originalName` | string | Sim | Nome original fornecido no upload, tratado como dado de exibição e nunca como caminho físico. |
| `size` | number | Sim | Tamanho do arquivo em bytes. Deve ser inteiro não negativo e não exceder 10 MiB. |
| `mimeType` | string | Sim | MIME normalizado para o tipo aceito, conforme validação do backend. |
| `uploadedAt` | string | Sim | Data e hora do upload em ISO 8601, em UTC. |
| `owner` | string | Sim | Valor normalizado do header `X-User-Id` que iniciou o upload. |

### Dados internos de armazenamento

O repositório pode manter, junto aos metadados, um campo interno como `storageName` ou `storagePath` para localizar o arquivo no disco. Esse dado:

- deve ser criado pelo servidor e resolvido dentro de `backend/storage`;
- não deve ser aceito como entrada do cliente nem incluído nas respostas públicas da API;
- não deve substituir o identificador `id` exposto nas rotas.

A coleção em memória pode ser implementada com a estrutura mais simples adequada ao repositório, por exemplo, um `Map` indexado por `id`. A estrutura concreta é detalhe de implementação, desde que preserve unicidade, filtro por `owner` e acesso ao arquivo associado.

## 6. Contratos de API

### Convenções

- Rotas do backend: `/upload`, `/documents` e `/documents/:id/download`.
- No desenvolvimento local, o frontend chama as mesmas rotas sob o prefixo `/api`. O proxy configurado no Vite remove `/api` antes de encaminhar a requisição ao backend. Portanto, `/api/documents` no navegador chega ao Express como `/documents`.
- `X-User-Id` é obrigatório nas três rotas. O servidor deve rejeitar valor ausente ou vazio após `trim` com `400 Bad Request`.
- Erros JSON seguem o formato `{ "error": { "code": "CODIGO", "message": "Descrição" } }` e usam `Content-Type: application/json; charset=utf-8`.
- As respostas de sucesso JSON também usam `Content-Type: application/json; charset=utf-8`.

### `POST /upload`

Envia um arquivo e registra seus metadados.

**Headers**

- `X-User-Id: <identificador-do-usuario>` (obrigatório)
- `Content-Type: multipart/form-data; boundary=...` (definido pelo cliente HTTP)

**Corpo**

- Multipart com exatamente um arquivo no campo `file`.
- Formatos aceitos: PDF, DOC, DOCX e TXT.
- O backend valida a extensão, o MIME e o conteúdo básico correspondente ao formato.
- Tamanho máximo: 10 MiB.

**Sucesso: `201 Created`**

```json
{
  "document": {
    "id": "d8e3b615-60f0-49f7-9c2a-795940a05207",
    "originalName": "relatorio.pdf",
    "size": 24576,
    "mimeType": "application/pdf",
    "uploadedAt": "2026-10-28T15:30:00.000Z",
    "owner": "usuario-123"
  }
}
```

O objeto de resposta não deve conter caminho local, nome físico de armazenamento ou conteúdo binário.

**Erros**

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `INVALID_USER` | `X-User-Id` ausente ou vazio. |
| `400` | `FILE_REQUIRED` | Campo `file` ausente ou sem arquivo. |
| `400` | `INVALID_MULTIPART` | Corpo multipart malformado ou campo multipart inesperado. |
| `413` | `FILE_TOO_LARGE` | Arquivo excede 10 MiB. |
| `415` | `UNSUPPORTED_FILE_TYPE` | Extensão, MIME ou assinatura/conteúdo não permitido ou incompatível. |
| `500` | `UPLOAD_FAILED` | Falha inesperada ao gravar arquivo ou registrar metadados. A resposta não expõe detalhes internos. |

Se a gravação falhar, nenhum metadado deve ser registrado. Se ocorrer falha após a gravação e antes de concluir o registro, o backend deve tentar remover o arquivo parcial para evitar órfãos.

### `GET /documents`

Lista os documentos do usuário identificado. Não há paginação no MVP.

**Headers**

- `X-User-Id: <identificador-do-usuario>` (obrigatório)

**Sucesso: `200 OK`**

```json
{
  "documents": [
    {
      "id": "d8e3b615-60f0-49f7-9c2a-795940a05207",
      "originalName": "relatorio.pdf",
      "size": 24576,
      "mimeType": "application/pdf",
      "uploadedAt": "2026-10-28T15:30:00.000Z",
      "owner": "usuario-123"
    }
  ]
}
```

Quando o usuário ainda não tiver documentos, retornar `200 OK` com `{ "documents": [] }`. Não incluir caminhos ou nomes físicos internos.

**Erro**

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `INVALID_USER` | `X-User-Id` ausente ou vazio. |
| `500` | `LIST_FAILED` | Falha inesperada ao obter os metadados. |

### `GET /documents/:id/download`

Transmite o conteúdo do documento como anexo, somente se ele pertencer ao usuário identificado.

**Headers**

- `X-User-Id: <identificador-do-usuario>` (obrigatório)

**Sucesso: `200 OK`**

- Corpo: bytes do arquivo, sem envelopamento JSON.
- `Content-Type`: MIME validado e armazenado nos metadados.
- `Content-Disposition: attachment` com o nome original codificado de forma segura para uso em header HTTP.
- O servidor deve resolver o caminho de armazenamento internamente e confirmar que está contido em `backend/storage`.

**Erros**

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `INVALID_USER` | `X-User-Id` ausente ou vazio. |
| `404` | `DOCUMENT_NOT_FOUND` | ID inexistente, de outro usuário ou arquivo não disponível. A resposta é idêntica para não revelar documentos de terceiros. |
| `500` | `DOWNLOAD_FAILED` | Falha inesperada na leitura ou transmissão do arquivo. |

### `GET /health` (existente)

Endpoint operacional já implementado no seed. Retorna `200 OK` e `{ "status": "ok" }`. Não substitui verificações funcionais dos endpoints de documentos.

### Exemplo de erro JSON

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "O arquivo excede o limite de 10 MiB."
  }
}
```

## 7. Decisões arquiteturais

### Estado atual do repositório

- Backend em Node.js e Express, CommonJS. `backend/src/app.js` configura `express.json()`, registra as rotas de documentos e expõe `GET /health`.
- As rotas, controllers, services e repositories implementam upload, listagem e download; testes usam o runner nativo `node:test`.
- A pasta `backend/storage` é o destino local obrigatório para os uploads.
- Frontend em React e Vite, com módulos ES. `frontend/src/App.jsx` monta o fluxo de upload, listagem e download, e `frontend/src/services/documentsApi.js` consome a API.
- O proxy Vite encaminha `/api` para `http://localhost:3000` e remove o prefixo antes da requisição chegar ao backend.
- O backend usa o runner nativo de testes do Node (`node:test`).

### Direção arquitetural do MVP

- Manter dependências em uma única direção: `routes -> controllers -> services -> repositories`.
- `routes/`: declarar rotas e conectar middlewares, incluindo o middleware Multer necessário ao upload.
- `controllers/`: validar/normalizar a entrada HTTP, chamar serviços e traduzir resultados e erros para respostas HTTP.
- `services/`: aplicar regras de negócio, ownership e fluxo de upload/listagem/download sem depender de Express.
- `repositories/`: manter metadados em memória e encapsular acesso aos arquivos no filesystem local.
- Configurar Multer com `diskStorage` em `backend/storage`. Gerar nomes físicos únicos no servidor e manter `originalName` apenas como metadado de exibição.
- A interface React deve consumir a API com `fetch` por caminhos relativos `/api`, sem duplicar regras de negócio ou acesso ao filesystem.
- Usar `PORT` para a porta do backend, preservando o padrão atual de `3000`. Não adicionar banco de dados ou integração com storage externo.

## 8. Plano de execução

As etapas de implementação do MVP foram concluídas. A validação manual completa em navegador continua recomendada antes de qualquer implantação.

1. Criar o repositório de metadados em memória e armazenar arquivos localmente com Multer `diskStorage`.
2. Implementar os serviços de upload, listagem e download com filtro por `owner`.
3. Registrar controllers e rotas Express para os três endpoints, mantendo `GET /health`.
4. Cobrir limites, tipos, rollback, isolamento, erros HTTP e download com testes `node:test`.
5. Implementar cliente API e interface React para upload, listagem e download via proxy `/api`.
6. Executar a compilação do frontend e os testes do backend; realizar validação manual do fluxo completo antes da implantação.
