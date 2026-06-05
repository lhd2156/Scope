SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('core.Users', 'U') IS NOT NULL
   AND COL_LENGTH('core.Users', 'IsShowcase') IS NULL
BEGIN
    ALTER TABLE core.Users
        ADD IsShowcase BIT NOT NULL CONSTRAINT DF_core_Users_IsShowcase DEFAULT 0 WITH VALUES;
END;
GO

IF OBJECT_ID('core.Users', 'U') IS NOT NULL
   AND COL_LENGTH('core.Users', 'IsShowcase') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_Users_Showcase_Active_CreatedAt' AND object_id = OBJECT_ID('core.Users'))
BEGIN
    CREATE INDEX IX_core_Users_Showcase_Active_CreatedAt ON core.Users (IsShowcase, IsActive, CreatedAt);
END;
GO
