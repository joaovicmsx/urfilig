# HUD Assistente — Frontend (Fase 2)

Carrega seu `.glb` do mascote, aplica os 4 estados (IDLE/LISTENING/THINKING/SPEAKING)
via botões manuais, e já escuta os eventos do backend (Fase 1) via Socket.io.

## Pré-requisitos

- Node.js 18+
- O backend da Fase 1 rodando (`npm start` na pasta `hud-assistant-backend`) —
  opcional pra ver o mascote, mas necessário pra testar o fluxo completo

## Setup

```bash
npm install
```

Coloque seu `.glb` exportado do Blender em:

```
public/models/mascote.glb
```

(o nome precisa ser exatamente esse — se exportou com outro nome, renomeie o
arquivo ou ajuste o caminho em `src/main.js`)

Depois:

```bash
npm run dev
```

Abra o endereço que o Vite mostrar no terminal (geralmente `http://localhost:5173`).

## O que testar

1. O mascote aparece na tela? Se a tela ficar preta, abra o Console do navegador
   (F12) — o loader loga erros e o progresso de carregamento ali.
2. Clique nos botões IDLE / LISTENING / THINKING / SPEAKING (canto inferior
   esquerdo) — o texto "estado" no canto superior direito deve mudar.
3. Se seu `.glb` já tiver clipes de animação nomeados exatamente `IDLE`,
   `LISTENING`, `THINKING`, `SPEAKING`, a animação troca com crossfade suave.
   Se não tiver (comum nesse estágio), só o estado lógico muda — sem erro,
   é esperado.
4. Com o backend rodando, mande um comando de teste:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3000/api/comando -Method Post -ContentType "application/json" -Body '{"texto": "oi"}'
   ```
   O HUD deve reagir sozinho (THINKING → SPEAKING → IDLE) e mostrar a resposta
   no canto superior esquerdo — isso confirma o pipeline ponta a ponta.

## Console é seu amigo aqui

Todo aviso de "clipe não encontrado" ou "morph target não existe" é
propositalmente não-fatal — o app continua rodando pra você testar o resto,
só avisa o que falta no `.glb` pra próxima iteração do rig no Blender.

## Próximos passos (Fase 3)

- Flutuação livre do mascote (`src/mascot/float.js`, ainda não criado)
- Ver a nota "Arquitetura" no Obsidian pro roadmap completo
