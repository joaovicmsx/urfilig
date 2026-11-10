-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "contato" TEXT NOT NULL,
    "nicho" TEXT,
    "bio" TEXT,
    "score" INTEGER,
    "statusFunil" TEXT NOT NULL DEFAULT 'AGUARDANDO_APROVACAO',
    "pitch" TEXT,
    "ultimaInteracao" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MemoryLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "origemId" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    CONSTRAINT "MemoryLink_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "Memory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Diretriz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conteudo" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Reflexao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conteudo" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Temperamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traco" TEXT NOT NULL,
    "intensidade" INTEGER NOT NULL DEFAULT 1,
    "evidencia" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Bordao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situacao" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "vezesUsado" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RegistroEmocional" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sentimentoDetectado" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "respostaDada" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EstatisticaUso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "detalhe" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_contato_key" ON "Lead"("contato");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryLink_origemId_destinoId_key" ON "MemoryLink"("origemId", "destinoId");
