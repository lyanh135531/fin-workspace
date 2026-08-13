"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base";
import { useState } from "react";
import { Sliders, Folders, UsersRound } from "lucide-react";
import { WorkspaceSettings } from "./workspace-settings";
import { ImportCategoryPanel } from "./import-category-panel";
import { CategoryManagement } from "./category-management";
import { SettingsClient } from "./settings-client";
import { JoinRequestsClient } from "@/app/dashboard/join-requests/requests-client";

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
type TemplateCategory = {
  id: string;
  name: string;
  code: string;
  color: string;
  type: "income" | "expense";
  icon: string | null;
  parentId: string | null;
};
type Category = TemplateCategory & {
  status: "active" | "deactive";
  transactionCount: number;
};

interface Props {
  workspace: Workspace;
  isAdmin: boolean;
  templates: TemplateCategory[];
  categories: Category[];
  existingCodes: string[];
  members: Member[];
  roles: Role[];
  joinRequests: JoinRequest[];
  initialTab?: TabKey;
}

type TabKey = "general" | "categories" | "members";

export function WorkspaceSettingsTabsClient({
  workspace,
  isAdmin,
  templates,
  categories,
  existingCodes,
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
    { key: "general", label: "Cấu hình & Vận hành", icon: Sliders },
    {
      key: "categories",
      label: "Danh mục thu/chi",
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
      className="workspace-settings-tabs min-[901px]:gap-5"
    >
      <TabsList
        variant="navigation"
        className="workspace-settings-tab-list grid-cols-3 gap-1"
        aria-label="Workspace settings tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.key} value={tab.key} variant="navigation">
              <Icon />
              <span className="max-md:hidden">{tab.label}</span>
              <span className="md:hidden">
                {tab.key === "general"
                  ? "Chung"
                  : tab.key === "categories"
                    ? "Danh mục"
                    : "Thành viên"}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* General settings */}
      <TabsContent value="general" className="workspace-settings-tab-content">
        <div className="grid items-start gap-3 pt-4 sm:gap-8 min-[901px]:grid-cols-12 min-[901px]:gap-5 min-[901px]:pt-0">
          <div className="workspace-general-main min-[901px]:col-span-12">
            <WorkspaceSettings workspace={workspace} isAdmin={isAdmin} />
          </div>
        </div>
      </TabsContent>

      {/* Categories */}
      <TabsContent
        value="categories"
        className="workspace-settings-tab-content"
      >
        <div className="grid items-start gap-3 pt-4 sm:gap-6 min-[901px]:gap-5 min-[901px]:pt-0">
          <div className="workspace-category-import min-w-0 min-[901px]:order-2">
            <ImportCategoryPanel
              templates={templates}
              existingCodes={existingCodes}
            />
          </div>
          <div className="workspace-category-manager min-w-0 min-[901px]:order-1">
            <CategoryManagement categories={categories} />
          </div>
        </div>
      </TabsContent>

      {/* Members */}
      <TabsContent value="members" className="workspace-settings-tab-content">
        <div className="workspace-members-stack space-y-3 sm:space-y-6 sm:pt-4 min-[901px]:space-y-5 min-[901px]:pt-0">
          <SettingsClient roles={roles} members={members} isAdmin={isAdmin} />
          <JoinRequestsClient roles={roles} requests={joinRequests} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
