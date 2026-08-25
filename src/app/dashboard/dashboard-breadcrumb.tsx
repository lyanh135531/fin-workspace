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
  "/settings/account": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Đổi mật khẩu" },
  ],
  "/account": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Đổi mật khẩu" },
  ],
  "/settings/workspace": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Cài đặt nhóm" },
  ],
  "/workspaces/create": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Tạo nhóm mới" },
  ],
  "/settings/workspaces/create": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Tạo nhóm mới" },
  ],
  "/settings/join": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Tham gia nhóm" },
  ],
  "/dashboard": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Sổ giao dịch" },
  ],
  "/recurring-transactions": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Giao dịch định kỳ" },
  ],
  "/financial-plans": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Kế hoạch tài chính" },
  ],
  "/dashboard/overview": [{ label: "Tổng quan" }],
  "/dashboard/wallets": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Quản lý ví" },
  ],
  "/dashboard/settings": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Cài đặt nhóm" },
  ],
  "/dashboard/users": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Tài khoản thành viên" },
  ],
  "/dashboard/workspaces/create": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Tạo nhóm mới" },
  ],
  "/dashboard/join": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Tham gia nhóm" },
  ],
  "/dashboard/join-requests": [
    { label: "Tổng quan", href: "/overview" },
    { label: "Cài đặt nhóm", href: "/settings/workspace" },
    { label: "Yêu cầu tham gia" },
  ],
}

const segmentLabels: Record<string, string> = {
  dashboard: "Sổ giao dịch",
  join: "Tham gia nhóm",
  overview: "Tổng quan",
  settings: "Cài đặt",
  users: "Tài khoản thành viên",
  wallets: "Quản lý ví",
  workspace: "Nhóm tài chính",
  workspaces: "Nhóm tài chính",
  create: "Tạo mới",
  "join-requests": "Yêu cầu tham gia",
  "financial-plans": "Kế hoạch tài chính",
}

function getTrail(
  pathname: string,
  workspaces: Workspace[],
  currentWorkspace?: Workspace
): BreadcrumbEntry[] {
  const normalizedPath = pathname !== "/" ? pathname.replace(/\/$/, "") : pathname

  // 1. Contextual trails for active workspace
  if (currentWorkspace) {
    if (normalizedPath === "/dashboard") {
      return [
        { label: "Tổng quan", href: "/overview" },
        { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
        { label: "Sổ giao dịch" },
      ]
    }

    if (normalizedPath === "/wallets" || normalizedPath === "/dashboard/wallets") {
      return [
        { label: "Tổng quan", href: "/overview" },
        { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
        { label: "Quản lý ví" },
      ]
    }

    if (normalizedPath === "/recurring-transactions") {
      return [
        { label: "Tổng quan", href: "/overview" },
        { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
        { label: "Giao dịch định kỳ" },
      ];
    }

    if (normalizedPath === "/financial-plans") {
      return [
        { label: "Tổng quan", href: "/overview" },
        { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
        { label: "Kế hoạch tài chính" },
      ];
    }

    if (normalizedPath === "/settings/workspace" || normalizedPath === "/dashboard/settings") {
      return [
        { label: "Tổng quan", href: "/overview" },
        { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
        { label: "Cài đặt nhóm" },
      ]
    }

    if (normalizedPath === "/dashboard/join-requests") {
      return [
        { label: "Tổng quan", href: "/overview" },
        { label: currentWorkspace.name, href: `/workspace/${currentWorkspace.id}` },
        { label: "Cài đặt nhóm", href: "/settings/workspace" },
        { label: "Yêu cầu tham gia" },
      ]
    }
  }

  // 2. Fixed trails lookup
  const fixedTrail = fixedTrails[normalizedPath]
  if (fixedTrail) return fixedTrail

  // 3. Dynamic workspace detail page (/workspace/[id])
  const workspaceMatch = normalizedPath.match(/^\/workspace\/([^/]+)$/)
  if (workspaceMatch) {
    const workspaceId = decodeURIComponent(workspaceMatch[1])
    const workspace = workspaces.find((item) => item.id === workspaceId)
    return [
      { label: "Tổng quan", href: "/overview" },
      { label: workspace?.name ?? "Nhóm tài chính" },
    ]
  }

  // 4. Dynamic fallback route handling
  const cleanPath = normalizedPath.replace(/^\/dashboard(?=\/|$)/, "")
  const segments = cleanPath.split("/").filter(Boolean)
  if (!segments.length) return [{ label: "Tổng quan", href: "/overview" }, { label: "Sổ giao dịch" }]

  const result: BreadcrumbEntry[] = [{ label: "Tổng quan", href: "/overview" }]
  let accumulatedPath = ""

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLast = i === segments.length - 1
    accumulatedPath += `/${segment}`

    const label = segmentLabels[segment] ?? decodeURIComponent(segment).replaceAll("-", " ")
    result.push({
      label,
      href: isLast ? undefined : accumulatedPath,
    })
  }

  return result
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
