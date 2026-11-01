using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdentityService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddModerationAndSanctions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RestrictedUntilUtc",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SuspendedUntilUtc",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ResolvedAtUtc",
                table: "Reports",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Reports",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "Weight",
                table: "Reports",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0); // reports filed before weights existed count fully

            migrationBuilder.CreateTable(
                name: "ModerationActions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ModeratorId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetType = table.Column<int>(type: "integer", nullable: false),
                    TargetId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Action = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModerationActions", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "RestrictedUntilUtc", "SuspendedUntilUtc" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("9be75963-a399-4c4d-8c44-cd6817acb801"),
                columns: new[] { "RestrictedUntilUtc", "SuspendedUntilUtc" },
                values: new object[] { null, null });

            migrationBuilder.CreateIndex(
                name: "IX_Reports_Status_CreatedAtUtc",
                table: "Reports",
                columns: new[] { "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ModerationActions_CreatedAtUtc",
                table: "ModerationActions",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ModerationActions_TargetType_TargetId",
                table: "ModerationActions",
                columns: new[] { "TargetType", "TargetId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ModerationActions");

            migrationBuilder.DropIndex(
                name: "IX_Reports_Status_CreatedAtUtc",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "RestrictedUntilUtc",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SuspendedUntilUtc",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ResolvedAtUtc",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "Weight",
                table: "Reports");
        }
    }
}
