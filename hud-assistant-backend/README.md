# HUD Assistente — Backend

Backend em Node.js para o assistente virtual 3D, construído com arquitetura SaaS multiusuário, suporte a chamadas de LLM (Gemini/Ollama), síntese de voz local (Piper), banco de dados relacional e comunicação em tempo real via WebSockets.

##  Tecnologias

- **Node.js** (Express & WebSockets com Socket.io)
- **Prisma ORM** (SQLite)
- **Google Gen AI SDK** (`@google/genai`) / Ollama
- **Piper TTS** (Síntese de voz local)
- **JWT & Bcrypt** (Autenticação e segurança multiusuário)

##  Pré-requisitos

- **Node.js** 18+
- Executável do **Piper** e modelo de voz `.onnx` configurados na pasta `./piper`
- Chave de API do **Google Gemini** ou instância local do **Ollama**

### Conexão com Spotify

O Client ID pertence ao aplicativo Urfilig e deve ser configurado uma única vez no ambiente do backend. A pessoa usuária não precisa informar esse ID: ao tocar no botão do Spotify, ela entra na própria conta e autoriza o acesso.

1. Crie/configure o aplicativo Urfilig no [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) e copie o Client ID público.
2. Defina `SPOTIFY_CLIENT_ID` no `.env` do backend (use `.env.example` como referência). Não coloque Client Secret no frontend nem peça credenciais Spotify ao usuário.
3. Cadastre no Spotify o Redirect URI `http://127.0.0.1:3000/api/spotify/callback` (ou a porta definida em `PORT`). O valor precisa corresponder exatamente ao endereço usado pelo backend.
4. Reinicie o backend. A interface passa a abrir a autorização normal do Spotify; sem a configuração do app, o backend informa que a conexão ainda não está configurada.

## 🔧 Configuração e Instalação

1. Clone o repositório e instale as dependências:
   ```bash
   npm install
