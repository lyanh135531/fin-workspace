"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type Workspace = {
  id: string
  name: string
}

type BreadcrumbEntry = {
  label: string
  href?: string
}

const fixedTrails: Record<string, BreadcrumbEntry[]> = {
  "/overview": [{ label: "Tổng quan" }],
  "/wallets": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Quản lý ví" },
  ],
  "/setting": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Cài đặt chung" },
  ],
  "/settings/workspace": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Cài đặt workspace" },
  ],
  "/settings/users": [
    { label: "Cài đặt chung", href: "/setting" },
    { label: "Tài khoản thành viên" },
  ],
  "/settings/workspaces/create": [
    { label: "Cài đặt chung", href: "/setting" },
    { label: "Tạo workspace" },
  ],
  "/settings/join": [
    { label: "Cài đặt chung", href: "/setting" },
    { label: "Tham gia workspace" },
  ],
  "/dashboard": [{ label: "Sổ giao dịch" }],
  "/dashboard/overview": [{ label: "Tổng quan" }],
  "/dashboard/wallets": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Quản lý ví" },
  ],
  "/dashboard/settings": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Cài đặt workspace" },
  ],
  "/dashboard/settings/general": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Cài đặt chung" },
  ],
  "/dashboard/users": [
    { label: "Cài đặt chung", href: "/setting" },
    { label: "Tài khoản thành viên" },
  ],
  "/dashboard/workspaces/create": [
    { label: "Cài đặt chung", href: "/setting" },
    { label: "Tạo workspace" },
  ],
  "/dashboard/join": [
    { label: "Cài đặt chung", href: "/setting" },
    { label: "Tham gia workspace" },
  ],
  "/dashboard/invitations": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Lời mời workspace" },
  ],
  "/dashboard/join-requests": [
    { label: "Cài đặt workspace", href: "/settings/workspace" },
    { label: "Yêu cầu tham gia" },
  ],
}

const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  invitations: "Lời mời workspace",
  join: "Tham gia workspace",
  overview: "Tổng quan",
  setting: "Cài đặt chung",
  settings: "Cài đặt",
  users: "Thành viên",
  wallets: "Quản lý ví",
  workspace: "Workspace",
  workspaces: "Workspace",
  create: "Tạo mới",
  general: "Cài đặt chung",
}

function getTrail(
  pathname: string,
  workspaces: Workspace[],
  currentWorkspace?: Workspace
): BreadcrumbEntry[] {
  const normalizedPath = pathname !== "/" ? pathname.replace(/\/$/, "") : pathname

  if (currentWorkspace && (normalizedPath === "/wallets" || normalizedPath === "/dashboard/wallets")) {
    return [
      { label: "Tổng quan", href: "/overview" },
      { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
      { label: "Quản lý ví" },
    ]
  }

  if (currentWorkspace && (normalizedPath === "/settings/workspace" || normalizedPath === "/dashboard/settings")) {
    return [
      { label: "Tổng quan", href: "/overview" },
      { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
      { label: "Cài đặt workspace" },
    ]
  }

  if (currentWorkspace && normalizedPath === "/dashboard/join-requests") {
    return [
      { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
      { label: "Cài đặt workspace", href: "/settings/workspace" },
      { label: "Yêu cầu tham gia" },
    ]
  }

  const fixedTrail = fixedTrails[normalizedPath]
  if (fixedTrail) return fixedTrail

  const workspaceMatch = normalizedPath.match(/^\/workspace\/([^/]+)$/)
  if (workspaceMatch) {
    const workspaceId = decodeURIComponent(workspaceMatch[1])
    const workspace = workspaces.find((item) => item.id === workspaceId)
    return [
      { label: "Tổng quan", href: "/overview" },
      { label: workspace?.name ?? "Workspace" },
    ]
  }

  const segments = normalizedPath.split("/").filter(Boolean)
  if (!segments.length) return [{ label: "Trang chủ" }]

  return segments.map((segment, index) => {
    const isCurrent = index === segments.length - 1
    const label = segmentLabels[segment] ?? decodeURIComponent(segment).replaceAll("-", " ")
    return {
      label,
      href: isCurrent ? undefined : `/${segments.slice(0, index + 1).join("/")}`,
    }
  })
}

export function DashboardBreadcrumb({
  workspaces,
  currentWorkspace,
}: {
  workspaces: Workspace[]
  currentWorkspace?: Workspace
}) {
  const pathname = usePathname()
  const trail = getTrail(pathname, workspaces, currentWorkspace)

  return (
    <Breadcrumb aria-label="Đường dẫn trang">
      <BreadcrumbList className="flex-nowrap gap-1 overflow-hidden text-xs sm:gap-1.5 sm:text-sm">
        {trail.map((entry, index) => (
          <Fragment key={`${entry.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator className="shrink-0 text-muted-foreground/55" />}
            <BreadcrumbItem className="min-w-0">
              {entry.href ? (
                <BreadcrumbLink
                  className="truncate font-medium hover:text-primary"
                  render={<Link href={entry.href} />}
                >
                  {entry.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate font-semibold">
                  {entry.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
