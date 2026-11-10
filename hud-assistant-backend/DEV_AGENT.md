# Dev Agent supervisionado

A primeira versão do Dev Agent prepara tarefas de código sem editar ou publicar nada automaticamente.

## Fluxo

1. A pessoa cria uma tarefa com repositório e objetivo.
2. A IA devolve um plano estruturado, com risco, possíveis arquivos e testes.
3. O plano fica em `AGUARDANDO_APROVACAO`.
4. Ao aprovar, a aprovação é registrada. A execução continua bloqueada até a próxima etapa: GitHub App + workspace temporário isolado.
5. Na próxima etapa, o executor deverá criar branch temporária, aplicar um patch, rodar somente checks permitidos e mostrar o diff antes de push ou Pull Request.

O Dev Agent nunca deve fazer merge, deploy, push, migração de banco ou acesso a arquivos sensíveis sem uma aprovação humana específica.

## API

Todas as rotas exigem `Authorization: Bearer <JWT>`.

### Criar plano

`POST /api/dev-agent/tarefas`

```json
{
  "repositorio": "joaovicmsx/urfilig",
  "descricao": "Corrigir o tratamento de erros no login e cobrir com testes.",
  "provider": "gemini"
}
```

### Consultar tarefas

- `GET /api/dev-agent/tarefas`
- `GET /api/dev-agent/tarefas/:id`

### Aprovar ou cancelar

- `POST /api/dev-agent/tarefas/:id/aprovar`
- `POST /api/dev-agent/tarefas/:id/cancelar`

A aprovação não aciona comandos nem altera código nesta fase.

## Limites aplicados

- cada tarefa pertence ao usuário autenticado;
- aceita somente repositórios no formato `organizacao/projeto`;
- bloqueia `.env`, segredos, credenciais, chaves e `.git`;
- remove padrões de segredo das respostas armazenadas;
- não permite shell arbitrário, comandos destrutivos ou conteúdo de repositório mudar regras do agente;
- mantém status e plano auditáveis no banco.

## Próxima etapa de execução

Use uma GitHub App com escopo mínimo, jamais token no frontend ou aplicativo desktop. Configure no backend, por secret manager:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_INSTALLATION_ID`

A presença dessas variáveis apenas sinaliza que a integração está pronta para ser implementada. Esta versão ainda não chama a API do GitHub.

Também é necessário um executor isolado que limite CPU, memória, rede, duração e comandos permitidos. Ele deve trabalhar em cópia temporária do repositório e descartar o workspace após entregar diff, logs resumidos e resultado dos testes.
