-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nome" TEXT,
    "senhaHash" TEXT,
    "googleId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idade" INTEGER,
    "localizacao" TEXT,
    "profissao" TEXT,
    "hobbies" TEXT,
    "onboardingConcluido" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Usuario" ("criadoEm", "email", "googleId", "id", "nome", "senhaHash") SELECT "criadoEm", "email", "googleId", "id", "nome", "senhaHash" FROM "Usuario";
DROP TABLE "Usuario";
ALTER TABLE "new_Usuario" RENAME TO "Usuario";
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
