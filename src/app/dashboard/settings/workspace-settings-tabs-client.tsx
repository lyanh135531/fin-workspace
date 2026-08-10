"use client";

import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/base";
import { useState } from "react";
import { Sliders, Folders, UsersRound } from "lucide-react";
import { WorkspaceSettings } from "./workspace-settings";
import { InviteCodeCard } from "./invite-code-card";
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
type Member = { id: string; username: string; roleCode: string; isSelf: boolean };
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

  const tabs: { key: TabKey; label: string; icon: typeof Sliders; count?: number }[] = [
    { key: "general", label: "Cấu hình & Vận hành", icon: Sliders },
    { key: "categories", label: "Danh mục thu/chi", icon: Folders, count: categories.length },
    { key: "members", label: "Thành viên", icon: UsersRound, count: members.length },
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as TabKey)}
      className="workspace-settings-tabs"
    >
      <TabsList
        className="workspace-settings-tab-list"
        aria-label="Workspace settings tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
            >
              <Icon />
              <span className="max-md:hidden">{tab.label}</span>
              <span className="md:hidden">
                {tab.key === "general"
                  ? "Chung"
                  : tab.key === "categories"
                    ? "Danh mục"
                    : "Thành viên"}
              </span>
              {tab.count !== undefined && (
                <TabsCount>{tab.count}</TabsCount>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* ── Tab 1: Cấu hình & Vận hành ── */}
      <TabsContent value="general" className="workspace-settings-tab-content">
        <div className="grid items-start gap-3 pt-4 sm:gap-8 lg:grid-cols-12 xl:gap-12">
          <div className="workspace-general-main lg:col-span-7 xl:col-span-8">
            <WorkspaceSettings workspace={workspace} isAdmin={isAdmin} />
          </div>
          <div className="workspace-general-invite max-md:hidden lg:col-span-5 xl:col-span-4">
            <InviteCodeCard code={workspace.inviteCode} />
          </div>
        </div>
      </TabsContent>

      {/* ── Tab 2: Danh mục thu/chi ── */}
      <TabsContent value="categories" className="workspace-settings-tab-content">
        <div className="grid items-start gap-3 pt-4 sm:gap-6 xl:grid-cols-12">
          <div className="workspace-category-import min-w-0 xl:col-span-5">
            <ImportCategoryPanel
              templates={templates}
              existingCodes={existingCodes}
            />
          </div>
          <div className="workspace-category-manager min-w-0 xl:col-span-7">
            <CategoryManagement categories={categories} />
          </div>
        </div>
      </TabsContent>

      {/* ── Tab 3: Thành viên ── */}
      <TabsContent value="members" className="workspace-settings-tab-content">
        <div className="workspace-members-stack space-y-3 sm:space-y-6 sm:pt-4">
          <SettingsClient roles={roles} members={members} isAdmin={isAdmin} />
          <JoinRequestsClient roles={roles} requests={joinRequests} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
