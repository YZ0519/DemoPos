using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DemoPos.Api.Migrations
{
    /// <inheritdoc />
    public partial class ModuleR9_VoucherFixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add FK from TableMerges.AbsorbedSaleId → Sales.Id (SetNull on delete).
            // The column was created in ModuleR5_Vouchers without any FK constraint.
            migrationBuilder.AddForeignKey(
                name: "FK_TableMerges_Sales_AbsorbedSaleId",
                table: "TableMerges",
                column: "AbsorbedSaleId",
                principalTable: "Sales",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            // Index on AbsorbedSaleId for join / lookup performance.
            migrationBuilder.CreateIndex(
                name: "IX_TableMerges_AbsorbedSaleId",
                table: "TableMerges",
                column: "AbsorbedSaleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TableMerges_AbsorbedSaleId",
                table: "TableMerges");

            migrationBuilder.DropForeignKey(
                name: "FK_TableMerges_Sales_AbsorbedSaleId",
                table: "TableMerges");
        }
    }
}
