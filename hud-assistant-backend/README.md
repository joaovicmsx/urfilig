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

## 🔧 Configuração e Instalação

1. Clone o repositório e instale as dependências:
   ```bash
   npm install