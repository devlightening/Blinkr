using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdentityService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaceCollections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlaceCollections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Description = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Visibility = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ShareToken = table.Column<string>(type: "character varying(22)", maxLength: 22, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlaceCollections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlaceCollections_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlaceCollectionItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CollectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Category = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    Note = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: true),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    AddedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlaceCollectionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlaceCollectionItems_PlaceCollections_CollectionId",
                        column: x => x.CollectionId,
                        principalTable: "PlaceCollections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlaceCollectionItems_CollectionId_PlaceId",
                table: "PlaceCollectionItems",
                columns: new[] { "CollectionId", "PlaceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlaceCollectionItems_CollectionId_Position",
                table: "PlaceCollectionItems",
                columns: new[] { "CollectionId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_PlaceCollections_ShareToken",
                table: "PlaceCollections",
                column: "ShareToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlaceCollections_UserId_UpdatedAtUtc",
                table: "PlaceCollections",
                columns: new[] { "UserId", "UpdatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlaceCollectionItems");

            migrationBuilder.DropTable(
                name: "PlaceCollections");
        }
    }
}
