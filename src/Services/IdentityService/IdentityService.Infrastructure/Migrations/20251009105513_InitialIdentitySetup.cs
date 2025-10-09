using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace IdentityService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialIdentitySetup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserName = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Role = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "CreatedAt", "Email", "PasswordHash", "Role", "UserName" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111111"), new DateTime(2025, 10, 9, 10, 55, 12, 941, DateTimeKind.Utc).AddTicks(9578), "admin@blinkr.com", "$2a$11$hXLp/W1bdJoOpeMemeEDPOABORGf6dxnC6mOg6MtGYsuogWI3Esfu", "Admin", "admin" },
                    { new Guid("9be75963-a399-4c4d-8c44-cd6817acb801"), new DateTime(2025, 10, 9, 10, 55, 13, 90, DateTimeKind.Utc).AddTicks(4912), "ahmet@blinkr.com", "$2a$11$FN/SP5I8YtI75Mv0c.yr4OczFeKSi5ooBy56u1lopjH5P1CjbkaNS", "User", "ahmet" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
