using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlogService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_add_revisionPost_PostMedia_Enum_MediaType2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PostMedia_Posts_PostId",
                table: "PostMedia");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PostMedia",
                table: "PostMedia");

            migrationBuilder.RenameTable(
                name: "PostMedia",
                newName: "PostMedias");

            migrationBuilder.RenameIndex(
                name: "IX_PostMedia_PostId",
                table: "PostMedias",
                newName: "IX_PostMedias_PostId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PostMedias",
                table: "PostMedias",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_PostMedias_Posts_PostId",
                table: "PostMedias",
                column: "PostId",
                principalTable: "Posts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PostMedias_Posts_PostId",
                table: "PostMedias");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PostMedias",
                table: "PostMedias");

            migrationBuilder.RenameTable(
                name: "PostMedias",
                newName: "PostMedia");

            migrationBuilder.RenameIndex(
                name: "IX_PostMedias_PostId",
                table: "PostMedia",
                newName: "IX_PostMedia_PostId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PostMedia",
                table: "PostMedia",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_PostMedia_Posts_PostId",
                table: "PostMedia",
                column: "PostId",
                principalTable: "Posts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
