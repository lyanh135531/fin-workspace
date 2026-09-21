import { notFound } from "next/navigation";

import { getCreditCardsData } from "@/app/dashboard/credit-cards/credit-cards-data";
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
