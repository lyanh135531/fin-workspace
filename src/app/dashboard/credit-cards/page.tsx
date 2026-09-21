import { getCreditCardsData } from "@/app/dashboard/credit-cards/credit-cards-data";
import { CreditCardOverview } from "@/app/dashboard/wallets/credit-card-overview";
import { CreditCardCreate } from "@/app/dashboard/credit-cards/credit-card-create";
import { PageContainer } from "@/components/base";

export default async function CreditCardsPage() {
  const data = await getCreditCardsData();

  return (
    <PageContainer>
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--foreground)] truncate">
              Thẻ tín dụng
            </h1>
            <p className="hidden sm:block mt-1 text-sm text-[var(--text-secondary)]">
              Tạo thẻ, ghi nhận hoàn tiền, quản lý sao kê, trả góp và thanh toán tại một nơi.
            </p>
          </div>
          <div className="shrink-0">
            <CreditCardCreate
              currency={data.currency}
              canManage={data.canManage}
              fundingWallets={data.fundingWallets}
            />
          </div>
        </header>
        <CreditCardOverview
          workspaceId={data.workspaceId}
          currency={data.currency}
          businessDate={data.businessDate}
          cards={data.cards}
          canManage={data.canManage}
          canApprove={data.canApprove}
          fundingWallets={data.fundingWallets}
          wallets={data.selectableWallets}
          categories={data.categories}
        />
      </div>
    </PageContainer>
  );
}
