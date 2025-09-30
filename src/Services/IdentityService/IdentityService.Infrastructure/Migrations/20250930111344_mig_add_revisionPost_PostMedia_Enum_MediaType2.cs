using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdentityService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_add_revisionPost_PostMedia_Enum_MediaType2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2025, 9, 30, 11, 13, 43, 571, DateTimeKind.Utc).AddTicks(2552), "$2a$11$fLRxFZPIQZw1FBvIdlihCuuQhnmo8IDRaGP6pS6tFSOzId/CvzYlu" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2025, 9, 30, 11, 8, 13, 361, DateTimeKind.Utc).AddTicks(7997), "$2a$11$bXsxwPq6QHPuNKwg5NaZl.A5pH5dvJBEp1WqBh.ypggNV3.crNZUC" });
        }
    }
}
