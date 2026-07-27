using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlogService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStructuredSignalFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AudienceType",
                table: "Posts",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Public");

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAt",
                table: "Posts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdentityDisclosure",
                table: "Posts",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "LimitedProfile");

            migrationBuilder.AddColumn<string>(
                name: "LocationPrecision",
                table: "Posts",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "ApproximateArea");

            migrationBuilder.AddColumn<Guid>(
                name: "PlaceId",
                table: "Posts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignalType",
                table: "Posts",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "GeneralObservation");

            migrationBuilder.AddColumn<string>(
                name: "SignalValue",
                table: "Posts",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceType",
                table: "Posts",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Community");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AudienceType",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "IdentityDisclosure",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "LocationPrecision",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "PlaceId",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "SignalType",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "SignalValue",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "SourceType",
                table: "Posts");
        }
    }
}
