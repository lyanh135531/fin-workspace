"use client";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
export function SidebarToggle() { const [collapsed, setCollapsed] = useState(false); useEffect(() => { document.documentElement.dataset.sidebarCollapsed = String(collapsed); return () => { delete document.documentElement.dataset.sidebarCollapsed; }; }, [collapsed]); function toggle() { setCollapsed((value) => !value); } return <button className="dashboard-sidebar-toggle" type="button" onClick={toggle} title={collapsed ? "Hiện điều hướng" : "Ẩn điều hướng"} aria-label={collapsed ? "Hiện điều hướng" : "Ẩn điều hướng"} aria-pressed={collapsed}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button>; }
