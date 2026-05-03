using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DemoPos.Api.Migrations
{
    /// <inheritdoc />
    public partial class ModuleR5_Vouchers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TableMerges",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PrimarySaleId = table.Column<int>(type: "int", nullable: false),
                    AbsorbedTableId = table.Column<int>(type: "int", nullable: true),
                    AbsorbedSaleId = table.Column<int>(type: "int", nullable: true),
                    MergedByUserId = table.Column<int>(type: "int", nullable: true),
                    MergedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableMerges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TableMerges_RestaurantTables_AbsorbedTableId",
                        column: x => x.AbsorbedTableId,
                        principalTable: "RestaurantTables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TableMerges_Sales_PrimarySaleId",
                        column: x => x.PrimarySaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TableMerges_Users_MergedByUserId",
                        column: x => x.MergedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "VoucherPackages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DiscountType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DiscountValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AppliesTo = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ValidFrom = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ValidUntil = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoucherPackages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VoucherPackageItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VoucherPackageId = table.Column<int>(type: "int", nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    OverridePrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoucherPackageItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VoucherPackageItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VoucherPackageItems_VoucherPackages_VoucherPackageId",
                        column: x => x.VoucherPackageId,
                        principalTable: "VoucherPackages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TableMerges_AbsorbedTableId",
                table: "TableMerges",
                column: "AbsorbedTableId");

            migrationBuilder.CreateIndex(
                name: "IX_TableMerges_MergedByUserId",
                table: "TableMerges",
                column: "MergedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TableMerges_PrimarySaleId",
                table: "TableMerges",
                column: "PrimarySaleId");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherPackageItems_ProductId",
                table: "VoucherPackageItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherPackageItems_VoucherPackageId_ProductId",
                table: "VoucherPackageItems",
                columns: new[] { "VoucherPackageId", "ProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VoucherPackages_Code",
                table: "VoucherPackages",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VoucherPackages_IsActive",
                table: "VoucherPackages",
                column: "IsActive");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TableMerges");

            migrationBuilder.DropTable(
                name: "VoucherPackageItems");

            migrationBuilder.DropTable(
                name: "VoucherPackages");
        }
    }
}
