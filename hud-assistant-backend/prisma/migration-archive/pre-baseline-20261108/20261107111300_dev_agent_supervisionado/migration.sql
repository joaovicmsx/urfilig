CREATE TYPE "DevAgentTaskStatus" AS ENUM (
    'PLANEJADA',
    'AGUARDANDO_APROVACAO',
    'APROVADA',
    'EM_EXECUCAO',
    'CONCLUIDA',
    'BLOQUEADA',
    'CANCELADA'
);

CREATE TABLE "DevAgentTask" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "repositorio" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "DevAgentTaskStatus" NOT NULL DEFAULT 'PLANEJADA',
    "plano" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevAgentTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DevAgentTask_usuarioId_createdAt_idx" ON "DevAgentTask"("usuarioId", "createdAt");

ALTER TABLE "DevAgentTask"
ADD CONSTRAINT "DevAgentTask_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
