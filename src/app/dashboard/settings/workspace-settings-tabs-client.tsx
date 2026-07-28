"use client";

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
  approvalRequired: boolean;
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
  recurringCount: number;
  mergedIntoId: string | null;
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
  isOwner: boolean;
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
  isOwner,
  initialTab = "general",
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const tabs: { key: TabKey; label: string; icon: typeof Sliders; count?: number }[] = [
    { key: "general", label: "Cấu hình & Vận hành", icon: Sliders },
    ...(isOwner ? [{ key: "categories" as const, label: "Danh mục thu/chi", icon: Folders, count: categories.length }] : []),
    { key: "members", label: "Thành viên", icon: UsersRound, count: members.length },
  ];

  return (
    <div className="space-y-6">
      {/* ── Pill Tab Navigation ── */}
      <div className="ws-pill-tabs" role="tablist" aria-label="Workspace settings tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`ws-pill-tab ${isActive ? "ws-pill-tab-active" : ""}`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="ws-pill-tab-count">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab 1: Cấu hình & Vận hành ── */}
      {activeTab === "general" && (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7">
            <WorkspaceSettings workspace={workspace} isAdmin={isOwner} />
          </div>
          <div className="lg:col-span-5">
            <InviteCodeCard code={workspace.inviteCode} />
          </div>
        </div>
      )}

      {/* ── Tab 2: Danh mục thu/chi ── */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <ImportCategoryPanel templates={templates} existingCodes={existingCodes} />
          <CategoryManagement categories={categories} />
        </div>
      )}

      {/* ── Tab 3: Thành viên ── */}
      {activeTab === "members" && (
        <div className="space-y-6">
          <SettingsClient roles={roles} members={members} isAdmin={isAdmin} />
          <JoinRequestsClient roles={roles} requests={joinRequests} />
        </div>
      )}
    </div>
  );
}
