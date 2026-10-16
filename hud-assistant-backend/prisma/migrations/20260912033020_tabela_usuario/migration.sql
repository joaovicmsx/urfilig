/*
  Warnings:

  - Added the required column `usuarioId` to the `Bordao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `Diretriz` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `EstatisticaUso` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `Lead` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `Memory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `Reflexao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `RegistroEmocional` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `Temperamento` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nome" TEXT,
    "senhaHash" TEXT,
    "googleId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bordao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "vezesUsado" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bordao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Bordao" ("createdAt", "id", "situacao", "texto", "vezesUsado") SELECT "createdAt", "id", "situacao", "texto", "vezesUsado" FROM "Bordao";
DROP TABLE "Bordao";
ALTER TABLE "new_Bordao" RENAME TO "Bordao";
CREATE TABLE "new_Diretriz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Diretriz_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Diretriz" ("ativo", "conteudo", "createdAt", "id", "tags") SELECT "ativo", "conteudo", "createdAt", "id", "tags" FROM "Diretriz";
DROP TABLE "Diretriz";
ALTER TABLE "new_Diretriz" RENAME TO "Diretriz";
CREATE TABLE "new_EstatisticaUso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalhe" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstatisticaUso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EstatisticaUso" ("createdAt", "detalhe", "id", "tipo") SELECT "createdAt", "detalhe", "id", "tipo" FROM "EstatisticaUso";
DROP TABLE "EstatisticaUso";
ALTER TABLE "new_EstatisticaUso" RENAME TO "EstatisticaUso";
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contato" TEXT NOT NULL,
    "nicho" TEXT,
    "bio" TEXT,
    "score" INTEGER,
    "statusFunil" TEXT NOT NULL DEFAULT 'AGUARDANDO_APROVACAO',
    "pitch" TEXT,
    "ultimaInteracao" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("bio", "contato", "createdAt", "id", "nicho", "nome", "pitch", "score", "statusFunil", "ultimaInteracao", "updatedAt") SELECT "bio", "contato", "createdAt", "id", "nicho", "nome", "pitch", "score", "statusFunil", "ultimaInteracao", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_usuarioId_contato_key" ON "Lead"("usuarioId", "contato");
CREATE TABLE "new_Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Memory_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Memory" ("categoria", "conteudo", "createdAt", "id", "tags", "titulo", "updatedAt") SELECT "categoria", "conteudo", "createdAt", "id", "tags", "titulo", "updatedAt" FROM "Memory";
DROP TABLE "Memory";
ALTER TABLE "new_Memory" RENAME TO "Memory";
CREATE TABLE "new_Reflexao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reflexao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reflexao" ("conteudo", "data", "id") SELECT "conteudo", "data", "id" FROM "Reflexao";
DROP TABLE "Reflexao";
ALTER TABLE "new_Reflexao" RENAME TO "Reflexao";
CREATE TABLE "new_RegistroEmocional" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "sentimentoDetectado" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "respostaDada" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroEmocional_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RegistroEmocional" ("contexto", "createdAt", "id", "respostaDada", "sentimentoDetectado") SELECT "contexto", "createdAt", "id", "respostaDada", "sentimentoDetectado" FROM "RegistroEmocional";
DROP TABLE "RegistroEmocional";
ALTER TABLE "new_RegistroEmocional" RENAME TO "RegistroEmocional";
CREATE TABLE "new_Temperamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "traco" TEXT NOT NULL,
    "intensidade" INTEGER NOT NULL DEFAULT 1,
    "evidencia" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Temperamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Temperamento" ("ativo", "atualizadoEm", "createdAt", "evidencia", "id", "intensidade", "traco") SELECT "ativo", "atualizadoEm", "createdAt", "evidencia", "id", "intensidade", "traco" FROM "Temperamento";
DROP TABLE "Temperamento";
ALTER TABLE "new_Temperamento" RENAME TO "Temperamento";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");
