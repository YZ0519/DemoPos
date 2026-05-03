using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DemoPos.Api.Migrations
{
    /// <inheritdoc />
    public partial class Module_SB_StockBundle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PosCarts_UserId_ProductId",
                table: "PosCarts");

            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "SaleItems",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "BundleHeaderSaleItemId",
                table: "SaleItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsBundleHeader",
                table: "SaleItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ProductBundleId",
                table: "SaleItems",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "PosCarts",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "BundleHeaderPosCartId",
                table: "PosCarts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsBundleHeader",
                table: "PosCarts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ProductBundleId",
                table: "PosCarts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProductBundles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MinItems = table.Column<int>(type: "int", nullable: false),
                    MaxItems = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductBundles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_BundleHeaderSaleItemId",
                table: "SaleItems",
                column: "BundleHeaderSaleItemId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_ProductBundleId",
                table: "SaleItems",
                column: "ProductBundleId");

            migrationBuilder.CreateIndex(
                name: "IX_PosCarts_BundleHeaderPosCartId",
                table: "PosCarts",
                column: "BundleHeaderPosCartId");

            migrationBuilder.CreateIndex(
                name: "IX_PosCarts_ProductBundleId",
                table: "PosCarts",
                column: "ProductBundleId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBundles_IsActive",
                table: "ProductBundles",
                column: "IsActive");

            migrationBuilder.AddForeignKey(
                name: "FK_PosCarts_PosCarts_BundleHeaderPosCartId",
                table: "PosCarts",
                column: "BundleHeaderPosCartId",
                principalTable: "PosCarts",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_PosCarts_ProductBundles_ProductBundleId",
                table: "PosCarts",
                column: "ProductBundleId",
                principalTable: "ProductBundles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_ProductBundles_ProductBundleId",
                table: "SaleItems",
                column: "ProductBundleId",
                principalTable: "ProductBundles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_SaleItems_BundleHeaderSaleItemId",
                table: "SaleItems",
                column: "BundleHeaderSaleItemId",
                principalTable: "SaleItems",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PosCarts_PosCarts_BundleHeaderPosCartId",
                table: "PosCarts");

            migrationBuilder.DropForeignKey(
                name: "FK_PosCarts_ProductBundles_ProductBundleId",
                table: "PosCarts");

            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_ProductBundles_ProductBundleId",
                table: "SaleItems");

            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_SaleItems_BundleHeaderSaleItemId",
                table: "SaleItems");

            migrationBuilder.DropTable(
                name: "ProductBundles");

            migrationBuilder.DropIndex(
                name: "IX_SaleItems_BundleHeaderSaleItemId",
                table: "SaleItems");

            migrationBuilder.DropIndex(
                name: "IX_SaleItems_ProductBundleId",
                table: "SaleItems");

            migrationBuilder.DropIndex(
                name: "IX_PosCarts_BundleHeaderPosCartId",
                table: "PosCarts");

            migrationBuilder.DropIndex(
                name: "IX_PosCarts_ProductBundleId",
                table: "PosCarts");

            migrationBuilder.DropColumn(
                name: "BundleHeaderSaleItemId",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "IsBundleHeader",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "ProductBundleId",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "BundleHeaderPosCartId",
                table: "PosCarts");

            migrationBuilder.DropColumn(
                name: "IsBundleHeader",
                table: "PosCarts");

            migrationBuilder.DropColumn(
                name: "ProductBundleId",
                table: "PosCarts");

            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "SaleItems",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "PosCarts",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PosCarts_UserId_ProductId",
                table: "PosCarts",
                columns: new[] { "UserId", "ProductId" },
                unique: true);
        }
    }
}
