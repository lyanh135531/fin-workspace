"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base";
import { useState } from "react";
import { Sliders, Folders, UsersRound } from "lucide-react";
import { WorkspaceSettings } from "./workspace-settings";
import { CategoryManagement } from "./category-management";
import { SettingsClient } from "./settings-client";
import { JoinRequestsClient } from "@/app/dashboard/join-requests/requests-client";
import type { FinancialJarCode } from "@/domain";

type Workspace = {
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
  isAdmin,
  categories,
  members,
  roles,
  joinRequests,
  initialTab = "general",
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const tabs: {
    key: TabKey;
    label: string;
    icon: typeof Sliders;
  }[] = [
      { key: "general", label: "Cài đặt nhóm", icon: Sliders },
      {
        key: "categories",
        label: "Danh mục thu chi",
        icon: Folders,
      },
      {
        key: "members",
        label: "Thành viên",
        icon: UsersRound,
      },
    ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as TabKey)}
      className="workspace-settings-tabs md:gap-5"
    >
      <TabsList
        variant="navigation"
        className="w-full md:w-fit"
        aria-label="Các mục cài đặt nhóm tài chính"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.key} value={tab.key} variant="navigation">
              <Icon />
              <span>{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* General settings */}
      <TabsContent value="general" className="workspace-settings-tab-content">
        <div className="grid items-start gap-3 pt-4 md:grid-cols-12 md:gap-5 md:pt-0">
          <div className="workspace-general-main md:col-span-12">
            <WorkspaceSettings workspace={workspace} isAdmin={isAdmin} />
          </div>
        </div>
      </TabsContent>

      {/* Categories */}
      <TabsContent
        value="categories"
        className="workspace-settings-tab-content"
      >
        <div className="grid items-start gap-3 pt-4 md:gap-5 md:pt-0">
          <div className="workspace-category-manager min-w-0 md:order-1">
            <CategoryManagement categories={categories} />
          </div>
        </div>
      </TabsContent>

      {/* Members */}
      <TabsContent value="members" className="workspace-settings-tab-content">
        <div className="workspace-members-stack space-y-3 pt-4 md:space-y-5 md:pt-0">
          <SettingsClient roles={roles} members={members} isAdmin={isAdmin} />
          <JoinRequestsClient roles={roles} requests={joinRequests} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
