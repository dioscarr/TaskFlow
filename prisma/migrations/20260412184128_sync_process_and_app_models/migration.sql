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
ALTER TABLE "AppDeployment" ADD CONSTRAINT "AppDeployment_appId_fkey" FOREIGN KEY ("appId") REFERENCES "WorkspaceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppDeployment" ADD CONSTRAINT "AppDeployment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
