"use client";

import {
  Tabs,
  TabsContent,
  TabsCount,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import { useState } from "react";
import { Sliders, Folders, UsersRound } from "lucide-react";
import { WorkspaceSettings } from "./workspace-settings";
import { CategoryManagement } from "./category-management";
import { SettingsClient } from "./settings-client";
import { JoinRequestsClient } from "@/app/dashboard/join-requests/requests-client";
import type { FinancialJarCode } from "@/domain";

type Workspace = {
  id?: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  timeZone: string;
  status: "active" | "deactive";
  inviteCode: string;
};

type Role = { code: string; name: string };
type Member = {
  id: string;
  username: string;
  roleCode: string;
  isSelf: boolean;
};
type JoinRequest = { id: string; username: string };
type CategoryBase = {
  id: string;
  name: string;
  code: string;
  color: string;
  type: "income" | "expense";
  icon: string | null;
  parentId: string | null;
};
type Category = CategoryBase & {
  jarCode: FinancialJarCode | null;
  status: "active" | "deactive";
  transactionCount: number;
};

interface Props {
  workspace: Workspace;
  workspaceId?: string;
  isAdmin: boolean;
  categories: Category[];
  members: Member[];
  roles: Role[];
  joinRequests: JoinRequest[];
  initialTab?: TabKey;
}

type TabKey = "general" | "categories" | "members";

export function WorkspaceSettingsTabsClient({
  workspace,
  workspaceId,
  isAdmin,
  categories,
  members,
  roles,
  joinRequests,
  initialTab = "general",
}: Props) {
  const resolvedWorkspaceId = workspaceId ?? workspace.id;
  const [tabState, setTabState] = useState<{
    baseTab: TabKey;
    activeTab: TabKey;
  }>({
    baseTab: initialTab,
    activeTab: initialTab,
  });
  const activeTab =
    tabState.baseTab === initialTab ? tabState.activeTab : initialTab;

  const tabs: {
    key: TabKey;
    label: string;
    mobileLabel: string;
    icon: typeof Sliders;
    count?: string | number;
    highlightCount?: boolean;
  }[] = [
    {
      key: "general",
      label: "Cài đặt nhóm",
      mobileLabel: "Cài đặt",
      icon: Sliders,
    },
    {
      key: "categories",
      label: "Danh mục thu chi",
      mobileLabel: "Danh mục",
      icon: Folders,
      count: categories.length,
    },
    {
      key: "members",
      label: "Thành viên",
      mobileLabel: "Thành viên",
      icon: UsersRound,
      count:
        joinRequests.length > 0
          ? `${members.length}+${joinRequests.length}`
          : members.length,
      highlightCount: joinRequests.length > 0,
    },
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) =>
        setTabState({ baseTab: initialTab, activeTab: value as TabKey })
      }
      className="workspace-settings-tabs gap-3.5 md:gap-5"
    >
      <TabsList
        variant="navigation"
        className="grid w-full grid-cols-3 md:inline-flex md:w-fit"
        aria-label="Các mục cài đặt nhóm tài chính"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              variant="navigation"
              className="w-full gap-1 px-1.5 text-xs [&_svg]:size-3.5 md:w-auto md:gap-1.5 md:px-3.5 md:text-sm md:[&_svg]:size-4"
            >
              <Icon />
              <span className="md:hidden">{tab.mobileLabel}</span>
              <span className="hidden md:inline">{tab.label}</span>
              {tab.count !== undefined && (
                <TabsCount
                  className={
                    tab.highlightCount
                      ? "h-4 min-w-4 bg-[var(--warning-soft)] px-1 text-[10px] text-[var(--warning)] md:h-5 md:min-w-5 md:px-1.5 md:text-[11px]"
                      : "h-4 min-w-4 px-1 text-[10px] md:h-5 md:min-w-5 md:px-1.5 md:text-[11px]"
                  }
                >
                  {tab.count}
                </TabsCount>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* General settings */}
      <TabsContent value="general" className="workspace-settings-tab-content">
        <div className="grid items-start gap-3 md:grid-cols-12 md:gap-5">
          <div className="workspace-general-main md:col-span-12">
            <WorkspaceSettings
              workspace={workspace}
              isAdmin={isAdmin}
              workspaceId={resolvedWorkspaceId}
            />
          </div>
        </div>
      </TabsContent>

      {/* Categories */}
      <TabsContent
        value="categories"
        className="workspace-settings-tab-content"
      >
        <div className="grid items-start gap-3 md:gap-5">
          <div className="workspace-category-manager min-w-0 md:order-1">
            <CategoryManagement
              categories={categories}
              workspaceId={resolvedWorkspaceId}
            />
          </div>
        </div>
      </TabsContent>

      {/* Members */}
      <TabsContent value="members" className="workspace-settings-tab-content">
        <div className="workspace-members-stack space-y-3.5 md:space-y-5">
          <SettingsClient
            roles={roles}
            members={members}
            isAdmin={isAdmin}
            workspaceId={resolvedWorkspaceId}
          />
          <JoinRequestsClient
            roles={roles}
            requests={joinRequests}
            workspaceId={resolvedWorkspaceId}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
