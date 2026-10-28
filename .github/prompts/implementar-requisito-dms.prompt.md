---
description: "Implementa um requisito pontual do DMS conforme a especificação e valida a mudança."
name: implementar-requisito-dms
argument-hint: "comportamento desejado (ex. rejeitar arquivo acima de 10 MiB)"
agent: agent
---

# Implementar requisito do DMS

Implemente este requisito do Document Management System:

`${input:requisito:Descreva o comportamento desejado}`

Use a [especificação do DMS](../../docs/specs/dms-spec.md) como contrato funcional e siga as [instruções do projeto](../copilot-instructions.md).

Antes de editar:

1. Localize o fluxo existente e os testes mais próximos do requisito.
2. Identifique a camada responsável e preserve o fluxo backend `routes -> controllers -> services -> repositories`; no frontend, reutilize `components/` e `services/` e consuma a API via `fetch` com prefixo `/api`.
3. Se o pedido conflitar com a especificação ou exigir uma decisão de produto ausente, exponha o conflito e peça esclarecimento antes de alterar o contrato.

Ao implementar:

- Faça a menor mudança coerente, sem reescrever módulos não relacionados nem duplicar responsabilidades.
- Preserve as convenções, APIs públicas e tratamento de erros existentes.
- No backend, mantenha uploads no filesystem local com Multer `diskStorage` em `backend/storage` e metadados em memória; não introduza storage externo, banco de dados ou autenticação fora do escopo.
- Adicione ou ajuste testes para o comportamento e seus principais casos de erro, seguindo o runner e os padrões já usados no projeto.
- Não altere a especificação, instruções, dependências ou arquivos fora do escopo do requisito, a menos que seja necessário e justificado.

Valide com o teste, build ou verificação mais específica disponível. Na resposta final, resuma o comportamento implementado, liste os arquivos alterados e informe os comandos executados e seus resultados.