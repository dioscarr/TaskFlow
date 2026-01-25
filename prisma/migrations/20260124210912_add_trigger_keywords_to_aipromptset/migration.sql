-- AlterTable
ALTER TABLE "AIPromptSet" ADD COLUMN     "triggerKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
