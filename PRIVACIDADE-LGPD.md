# Privacidade e dados pessoais no Urfilig

Este documento descreve salvaguardas técnicas do projeto; não substitui avaliação jurídica nem define, por si só, conformidade com a LGPD. O controlador deve definir finalidades, bases legais, prazos e canais de atendimento antes de disponibilizar o produto a outras pessoas.

## Dados tratados

O backend mantém dados de conta e os registros funcionais associados ao usuário, incluindo contatos, notas, eventos/lembretes e configurações. Contatos podem conter nome, telefone, e-mail, anotações e informações financeiras (perfil de investidor, patrimônio estimado e objetivos). O acesso às rotas de contatos exige autenticação e isolamento por usuário.

## Contatos

Os campos pessoais de contatos são armazenados com AES-256-GCM no backend. O formato usa IV e tag de autenticação individuais por valor. Registros legados em texto puro são criptografados gradualmente quando a lista é consultada. A coluna `consentimentoContatoEm` registra quando a pessoa usuária confirmou que possui autorização ou outra base legal para registrar aqueles dados; essa confirmação não determina qual base legal se aplica.

Configure `CONTACTS_ENCRYPTION_KEY` no ambiente do backend com 32 bytes aleatórios em hexadecimal (64 caracteres). Gere uma chave com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Guarde-a em um gerenciador de segredos e faça backup protegido. Perder ou trocar a chave sem recriptografar os registros torna os contatos criptografados ilegíveis. Não coloque a chave no frontend, no repositório ou em logs. Para aplicar a coluna de confirmação, execute `npx prisma migrate deploy` no backend.

## Controles e operação

- As rotas de negócio exigem JWT; OAuth de desktop usa PKCE e o segredo do cliente não é enviado ao frontend.
- CORS permite apenas origens locais/Tauri conhecidas e origens explicitamente configuradas em `CORS_ALLOWED_ORIGINS`.
- A API aplica limites por IP; o limitador em memória é adequado a uma instância. Em implantação com múltiplas instâncias, substitua-o por armazenamento compartilhado.
- Respostas de erro da API não devem incluir mensagens internas, SQL, tokens ou stack traces. Logs devem usar códigos/tipos de erro e evitar conteúdo de contato.
- Antes de usar dados reais, defina consentimento ou outra base legal adequada, finalidade, retenção, exclusão, canal para exercer direitos e procedimento de resposta a incidentes.

## Direitos e retenção

O produto precisa oferecer processos para acesso, correção, exportação e exclusão de dados pessoais, incluindo cópias/backups e tokens de integrações. O operador deve definir e documentar prazos de retenção e comunicar esses prazos às pessoas usuárias.
