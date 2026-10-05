import { getCreditCardsData } from "@/app/dashboard/credit-cards/credit-cards-data";
import { CreditCardOverview } from "@/app/dashboard/wallets/credit-card-overview";
import { CreditCardCreate } from "@/app/dashboard/credit-cards/credit-card-create";
import { PageContainer } from "@/components/base";

export default async function CreditCardsPage() {
  const data = await getCreditCardsData();

  return (
    <PageContainer>
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
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
          createCardAction={
            <CreditCardCreate
              currency={data.currency}
              canManage={data.canManage}
              fundingWallets={data.fundingWallets}
            />
          }
        />
      </div>
    </PageContainer>
  );
}
