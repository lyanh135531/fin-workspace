import { notFound } from "next/navigation";

import { getCreditCardsData } from "@/app/dashboard/credit-cards/credit-cards-data";
import { CreditCardCreate } from "@/app/dashboard/credit-cards/credit-card-create";
import { CreditCardOverview } from "@/app/dashboard/wallets/credit-card-overview";
import { PageContainer } from "@/components/base";

export default async function CreditCardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const data = await getCreditCardsData();

  const currentCard = data.cards.find((c) => c.id === cardId);
  if (!currentCard) {
    notFound();
  }

  return (
    <PageContainer>
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <div className="hidden min-[901px]:block">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-[var(--foreground)] truncate">
                Thẻ tín dụng
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
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
        </div>
        <CreditCardOverview
          workspaceId={data.workspaceId}
          currency={data.currency}
          businessDate={data.businessDate}
          cards={data.cards}
          initialCardId={cardId}
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
