SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('core.Users', 'U') IS NOT NULL
   AND COL_LENGTH('core.Users', 'ProfileVisibility') IS NULL
BEGIN
    ALTER TABLE core.Users
        ADD ProfileVisibility NVARCHAR(16) NOT NULL
            CONSTRAINT DF_core_Users_ProfileVisibility DEFAULT 'friends' WITH VALUES;
END;
GO

IF OBJECT_ID('core.Users', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE name = 'CK_core_Users_ProfileVisibility'
         AND parent_object_id = OBJECT_ID('core.Users')
   )
BEGIN
    ALTER TABLE core.Users WITH CHECK
        ADD CONSTRAINT CK_core_Users_ProfileVisibility
            CHECK (ProfileVisibility IN ('public', 'friends', 'private'));
END;
GO
