-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "keywords" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "steps" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "emailId" TEXT,
    "emailSource" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "config" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" TEXT,
    "items" TEXT,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "highlightBgColor" TEXT,
    "highlightTextColor" TEXT,
    "highlightBorderColor" TEXT,
    "highlightFontWeight" TEXT,
    "parentId" TEXT,
    "userId" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storagePath" TEXT,
    "magicRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppDeployment" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "internalDomain" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "containerName" TEXT NOT NULL,
    "imageName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "logs" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPromptSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workflows" JSONB,
    "triggerKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIPromptSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlegraBill" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerId" TEXT,
    "identification" TEXT,
    "ncf" TEXT,
    "items" TEXT NOT NULL,
    "observations" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedName" TEXT,
    "ncfType" TEXT,
    "fileId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlegraBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "toolUsed" TEXT,
    "toolResult" JSONB,
    "toolArgs" JSONB,
    "thinking" TEXT,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActivity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "toolUsed" TEXT,
    "fileId" TEXT,
    "sessionId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "workerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "userId" TEXT NOT NULL,
    "parentJobId" TEXT,
    "iteration" INTEGER NOT NULL DEFAULT 0,
    "maxIterations" INTEGER NOT NULL DEFAULT 5,
    "feedback" JSONB,
    "nextAction" TEXT,
    "autonomyLevel" TEXT NOT NULL DEFAULT 'manual',
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromAgent" TEXT NOT NULL,
    "toAgent" TEXT,
    "messageType" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrototypeData" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrototypeData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT DEFAULT 'Zap',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "schema" JSONB NOT NULL,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handlerType" TEXT NOT NULL DEFAULT 'workflow',
    "handlerRef" TEXT,
    "workflow" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRegistry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "port" INTEGER,
    "pid" INTEGER,
    "path" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "healthUrl" TEXT,
    "healthCheckType" TEXT,
    "healthInterval" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "lastHealthCheck" TIMESTAMP(3),
    "healthStatus" TEXT,
    "responseTime" INTEGER,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolConfiguration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "path" TEXT,
    "version" TEXT,
    "config" JSONB NOT NULL,
    "healthCheck" JSONB,
    "lastHealthCheck" TIMESTAMP(3),
    "healthStatus" TEXT,
    "description" TEXT,
    "icon" TEXT DEFAULT 'Tool',
    "category" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "compactMode" BOOLEAN NOT NULL DEFAULT false,
    "notifications" JSONB NOT NULL DEFAULT '{"email": true, "push": true, "desktop": true}',
    "aiPersonality" TEXT NOT NULL DEFAULT 'professional',
    "defaultModel" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncedAt" TIMESTAMP(3),
    "healthStatus" TEXT,
    "spec" JSONB NOT NULL,
    "envVars" JSONB NOT NULL DEFAULT '[]',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "ediConfig" JSONB,
    "endpoints" JSONB NOT NULL DEFAULT '[]',
    "linkedApps" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "documentation" TEXT,
    "icon" TEXT DEFAULT 'Box',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceCredential" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildMetric" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "imageName" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "stage" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "AIPromptSet_name_key" ON "AIPromptSet"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AlegraBill_fileId_key" ON "AlegraBill"("fileId");

-- CreateIndex
CREATE INDEX "AgentJob_status_createdAt_idx" ON "AgentJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PrototypeData_appId_collection_idx" ON "PrototypeData"("appId", "collection");

-- CreateIndex
CREATE INDEX "Skill_userId_enabled_idx" ON "Skill"("userId", "enabled");

-- CreateIndex
CREATE INDEX "Skill_category_idx" ON "Skill"("category");

-- CreateIndex
CREATE INDEX "ProcessRegistry_userId_status_idx" ON "ProcessRegistry"("userId", "status");

-- CreateIndex
CREATE INDEX "ProcessRegistry_port_idx" ON "ProcessRegistry"("port");

-- CreateIndex
CREATE UNIQUE INDEX "ToolConfiguration_name_key" ON "ToolConfiguration"("name");

-- CreateIndex
CREATE INDEX "ToolConfiguration_userId_enabled_idx" ON "ToolConfiguration"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "AppSettings_userId_category_idx" ON "AppSettings"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_userId_category_key_key" ON "AppSettings"("userId", "category", "key");

-- CreateIndex
CREATE INDEX "AppResource_userId_type_idx" ON "AppResource"("userId", "type");

-- CreateIndex
CREATE INDEX "AppResource_userId_provider_idx" ON "AppResource"("userId", "provider");

-- CreateIndex
CREATE INDEX "AppResource_status_idx" ON "AppResource"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AppResource_userId_slug_key" ON "AppResource"("userId", "slug");

-- CreateIndex
CREATE INDEX "ResourceCredential_resourceId_idx" ON "ResourceCredential"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceCredential_userId_type_idx" ON "ResourceCredential"("userId", "type");

-- CreateIndex
CREATE INDEX "BuildMetric_appName_idx" ON "BuildMetric"("appName");

-- CreateIndex
CREATE INDEX "BuildMetric_success_idx" ON "BuildMetric"("success");

-- CreateIndex
CREATE INDEX "BuildMetric_createdAt_idx" ON "BuildMetric"("createdAt");

-- AddForeignKey
ALTER TABLE "IntentRule" ADD CONSTRAINT "IntentRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkspaceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppDeployment" ADD CONSTRAINT "AppDeployment_appId_fkey" FOREIGN KEY ("appId") REFERENCES "WorkspaceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppDeployment" ADD CONSTRAINT "AppDeployment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPromptSet" ADD CONSTRAINT "AIPromptSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlegraBill" ADD CONSTRAINT "AlegraBill_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "WorkspaceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlegraBill" ADD CONSTRAINT "AlegraBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivity" ADD CONSTRAINT "AgentActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivity" ADD CONSTRAINT "AgentActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "AgentJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AgentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrototypeData" ADD CONSTRAINT "PrototypeData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRegistry" ADD CONSTRAINT "ProcessRegistry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolConfiguration" ADD CONSTRAINT "ToolConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppResource" ADD CONSTRAINT "AppResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCredential" ADD CONSTRAINT "ResourceCredential_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AppResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCredential" ADD CONSTRAINT "ResourceCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

