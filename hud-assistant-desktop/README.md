# Urfilig Desktop (Tauri)

Empacota o HUD da Urfilig como um app desktop de verdade — janela nativa, ícone, sem precisar abrir navegador manualmente.

## ⚠️ Leia antes de tentar compilar

Esse projeto **não foi validado por compilação real** — meu ambiente de
sandbox só tem acesso a um Rust antigo (1.75, via `apt`) porque o
instalador oficial (`rustup`) está bloqueado pela minha política de rede.
O Tauri 2 atual exige uma versão mais nova. Escrevi tudo com cuidado a
partir do que sei da API do Tauri 2, mas **a primeira compilação de
verdade vai ser no seu PC** — é esperado que apareça algum erro de
sintaxe/API na primeira tentativa, principalmente no `main.rs`. Me manda o
erro exato que eu corrijo rápido.

## Layout de pastas necessário

Esse projeto espera ser uma pasta **irmã** dos outros dois já existentes:

```
sua-pasta-de-projetos/
├── hud-assistant-backend/
├── hud-assistant-frontend/
└── hud-assistant-desktop/     ← esse projeto novo
```

Se os nomes ou a posição relativa forem diferentes, ajuste os caminhos em
`src-tauri/tauri.conf.json` (`frontendDist`, `beforeBuildCommand`,
`bundle.resources`) e em `src-tauri/src/main.rs`.

## Setup (uma vez só)

### 1. Instalar o Rust
https://rustup.rs — baixe e rode o instalador. Isso também instala o
`cargo` (o gerenciador de pacotes/build do Rust).

### 2. Instalar o Microsoft C++ Build Tools
Necessário pro Rust compilar no Windows. Se você já instalou isso antes
(cogitamos lá atrás por causa do `ffi-napi`/Vosk e não seguiu), agora é
obrigatório de verdade:
https://visualstudio.microsoft.com/visual-cpp-build-tools/ — instale com
a carga "Desktop development with C++".

### 3. Instalar as dependências desse projeto
```powershell
cd hud-assistant-desktop
npm install
```

## Rodando em desenvolvimento

```powershell
npx tauri dev
```

Isso abre uma janela nativa carregando o frontend. **Em desenvolvimento,
o `main.rs` NÃO sobe o backend/Python sozinho** (só faz isso no build de
produção) — continue rodando o backend (`npm start`) e o servidor Python
da wake word manualmente, em terminais separados, exatamente como sempre
fez. É a forma mais segura de testar a janela nativa isoladamente antes
de somar a complexidade de subir tudo junto.

## Gerando o instalador Windows (.exe)

```powershell
npx tauri build
```

Isso gera um instalador NSIS em
`src-tauri/target/release/bundle/nsis/`. Nesse modo — diferente do `dev`
— o `main.rs` tenta subir o backend Node e o servidor Python **sozinho**,
copiados pra dentro do app através da configuração `bundle.resources` do
`tauri.conf.json`.

### ⚠️ Sobre o tamanho do instalador

O `tauri.conf.json` está configurado pra copiar a pasta
`hud-assistant-backend` inteira (incluindo `node_modules`, o modelo do
Vosk, o Piper e seu modelo de voz) pra dentro do instalador. Isso pode
gerar um instalador de **vários GB** — o modelo do Piper e do Vosk já são
grandes sozinhos. Se isso incomodar, dá pra otimizar depois (ex: baixar
os modelos na primeira execução em vez de embutir), mas pra uma primeira
versão funcionando, simplicidade venceu tamanho.

### ⚠️ Pré-requisito que o instalador NÃO resolve sozinho

O `main.rs` chama `npm start` e `python` assumindo que **Node.js e Python
já estão instalados no computador que vai RODAR o app** (não só no seu, o
de desenvolvimento). Isso é diferente de um app desktop "de verdade"
totalmente autocontido — é uma limitação consciente da abordagem mais
simples (rodar o Node.js do sistema em vez de compilar o backend inteiro
num executável único). Ver a seção "Caminho mais robusto" abaixo pra
entender o trade-off.

## Caminho mais robusto (não implementado ainda, fica pra depois)

A versão atual depende do Node.js/Python já estarem instalados na máquina
que roda o app — funciona bem pra você mesmo (já tem tudo instalado), mas
não seria ideal se você for distribuir esse `.exe` pra outra pessoa
instalar do zero. O upgrade natural seria compilar o backend inteiro num
executável standalone (via `pkg`, `nexe`, ou o recurso nativo do Node
"Single Executable Applications"), removendo a dependência de Node.js
externo — mas isso é mais complexo especificamente por causa do Prisma
(o motor de banco dele é um binário nativo separado, historicamente
complicado de embutir nesse tipo de empacotamento). Deixei isso como
próximo passo deliberadamente, não como esquecimento — resolver primeiro
"funciona no meu PC" antes de "funciona em qualquer PC".

## Ícones

Os ícones em `src-tauri/icons/` são **placeholders simples** que gerei
(um círculo ciano com "U", combinando com o tema do HUD) — troque pelos
ícones de verdade quando tiver a arte final. O Tauri tem um comando que
gera todos os tamanhos a partir de uma imagem só:
```powershell
npx tauri icon caminho/para/sua-imagem.png
```

## Relacionado

Ver "Urfilig Desktop com Tauri" no Obsidian pra mais contexto de decisão.
