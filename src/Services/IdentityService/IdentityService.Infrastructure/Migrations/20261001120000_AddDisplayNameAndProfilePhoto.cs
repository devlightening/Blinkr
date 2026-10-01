using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdentityService.Infrastructure.Migrations
{
    /// <summary>D-032: an optional display name and an optional profile photo. Existing users keep null (username and drawn avatar).</summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261001120000_AddDisplayNameAndProfilePhoto")]
    public partial class AddDisplayNameAndProfilePhoto : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "Users",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoVersion",
                table: "Users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "DisplayName", table: "Users");
            migrationBuilder.DropColumn(name: "PhotoVersion", table: "Users");
        }
    }
}
