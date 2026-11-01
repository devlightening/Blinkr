using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdentityService.Infrastructure.Migrations
{
    /// <summary>
    /// E-mail becomes unique regardless of case (the check was case-sensitive and there was no index at all).
    /// UserName gets a lookup index but NOT a unique one yet: two existing accounts already share a name, and
    /// silently renaming a person's account is not a migration's call. Registration enforces username
    /// uniqueness in code until that pair is resolved and the index can be made unique.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260921130000_AddCaseInsensitiveUserIndexes")]
    public partial class AddCaseInsensitiveUserIndexes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE UNIQUE INDEX \"UX_Users_Email_lower\" ON \"Users\" (lower(\"Email\"));");
            migrationBuilder.Sql("CREATE INDEX \"IX_Users_UserName_lower\" ON \"Users\" (lower(\"UserName\"));");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_Users_UserName_lower\";");
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"UX_Users_Email_lower\";");
        }
    }
}
