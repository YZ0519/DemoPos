using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DemoPos.Api.Migrations
{
    /// <inheritdoc />
    public partial class Module_MSB_MultiStepBundles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BundleStepId",
                table: "SaleItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BundleStepId",
                table: "PosCarts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BundleSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductBundleId = table.Column<int>(type: "int", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    MinQuantity = table.Column<int>(type: "int", nullable: false),
                    MaxQuantity = table.Column<int>(type: "int", nullable: false),
                    IsOptional = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BundleSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BundleSteps_ProductBundles_ProductBundleId",
                        column: x => x.ProductBundleId,
                        principalTable: "ProductBundles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BundleStepProducts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BundleStepId = table.Column<int>(type: "int", nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BundleStepProducts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BundleStepProducts_BundleSteps_BundleStepId",
                        column: x => x.BundleStepId,
                        principalTable: "BundleSteps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BundleStepProducts_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_BundleStepId",
                table: "SaleItems",
                column: "BundleStepId");

            migrationBuilder.CreateIndex(
                name: "IX_PosCarts_BundleStepId",
                table: "PosCarts",
                column: "BundleStepId");

            migrationBuilder.CreateIndex(
                name: "IX_BundleStepProducts_BundleStepId",
                table: "BundleStepProducts",
                column: "BundleStepId");

            migrationBuilder.CreateIndex(
                name: "IX_BundleStepProducts_BundleStepId_ProductId",
                table: "BundleStepProducts",
                columns: new[] { "BundleStepId", "ProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BundleStepProducts_ProductId",
                table: "BundleStepProducts",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_BundleSteps_ProductBundleId",
                table: "BundleSteps",
                column: "ProductBundleId");

            migrationBuilder.CreateIndex(
                name: "IX_BundleSteps_ProductBundleId_SortOrder",
                table: "BundleSteps",
                columns: new[] { "ProductBundleId", "SortOrder" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PosCarts_BundleSteps_BundleStepId",
                table: "PosCarts",
                column: "BundleStepId",
                principalTable: "BundleSteps",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_BundleSteps_BundleStepId",
                table: "SaleItems",
                column: "BundleStepId",
                principalTable: "BundleSteps",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PosCarts_BundleSteps_BundleStepId",
                table: "PosCarts");

            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_BundleSteps_BundleStepId",
                table: "SaleItems");

            migrationBuilder.DropTable(
                name: "BundleStepProducts");

            migrationBuilder.DropTable(
                name: "BundleSteps");

            migrationBuilder.DropIndex(
                name: "IX_SaleItems_BundleStepId",
                table: "SaleItems");

            migrationBuilder.DropIndex(
                name: "IX_PosCarts_BundleStepId",
                table: "PosCarts");

            migrationBuilder.DropColumn(
                name: "BundleStepId",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "BundleStepId",
                table: "PosCarts");
        }
    }
}
