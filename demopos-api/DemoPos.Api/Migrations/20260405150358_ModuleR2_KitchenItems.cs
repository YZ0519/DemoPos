using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DemoPos.Api.Migrations
{
    /// <inheritdoc />
    public partial class ModuleR2_KitchenItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DiscountType",
                table: "Sales",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VoucherCode",
                table: "Sales",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsVoided",
                table: "SaleItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "ItemDiscount",
                table: "SaleItems",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ItemDiscountType",
                table: "SaleItems",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "KitchenSentAt",
                table: "SaleItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifierNote",
                table: "SaleItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OverriddenPrice",
                table: "SaleItems",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "VoidedAt",
                table: "SaleItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VoidedByUserId",
                table: "SaleItems",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_VoidedByUserId",
                table: "SaleItems",
                column: "VoidedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_Users_VoidedByUserId",
                table: "SaleItems",
                column: "VoidedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_Users_VoidedByUserId",
                table: "SaleItems");

            migrationBuilder.DropIndex(
                name: "IX_SaleItems_VoidedByUserId",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "DiscountType",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "VoucherCode",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "IsVoided",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "ItemDiscount",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "ItemDiscountType",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "KitchenSentAt",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "ModifierNote",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "OverriddenPrice",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "VoidedAt",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "VoidedByUserId",
                table: "SaleItems");
        }
    }
}
