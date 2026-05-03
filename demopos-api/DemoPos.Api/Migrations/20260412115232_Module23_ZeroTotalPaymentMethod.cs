using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DemoPos.Api.Migrations
{
    /// <inheritdoc />
    public partial class Module23_ZeroTotalPaymentMethod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ZeroTotal",
                table: "PaymentMethods",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ZeroTotal",
                table: "PaymentMethods");
        }
    }
}
