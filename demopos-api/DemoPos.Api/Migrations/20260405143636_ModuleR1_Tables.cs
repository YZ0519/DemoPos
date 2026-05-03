using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DemoPos.Api.Migrations
{
    /// <inheritdoc />
    public partial class ModuleR1_Tables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OrderStatus",
                table: "Sales",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "paid");

            migrationBuilder.AddColumn<string>(
                name: "OrderType",
                table: "Sales",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "pos");

            migrationBuilder.AddColumn<int>(
                name: "TableId",
                table: "Sales",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TakeawayCharge",
                table: "Sales",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "RestaurantTables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Number = table.Column<int>(type: "int", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RestaurantTables", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Sales_OrderStatus",
                table: "Sales",
                column: "OrderStatus");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_TableId",
                table: "Sales",
                column: "TableId");

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantTables_IsActive",
                table: "RestaurantTables",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantTables_Status",
                table: "RestaurantTables",
                column: "Status");

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_RestaurantTables_TableId",
                table: "Sales",
                column: "TableId",
                principalTable: "RestaurantTables",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Sales_RestaurantTables_TableId",
                table: "Sales");

            migrationBuilder.DropTable(
                name: "RestaurantTables");

            migrationBuilder.DropIndex(
                name: "IX_Sales_OrderStatus",
                table: "Sales");

            migrationBuilder.DropIndex(
                name: "IX_Sales_TableId",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "OrderStatus",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "OrderType",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "TableId",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "TakeawayCharge",
                table: "Sales");
        }
    }
}
