import { Home, FileSpreadsheet, ImagePlus, FolderOpen, Settings, Zap } from "lucide-react";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "CSV Bulk Beschreibungen",
    url: "/csv-bulk-description",
    icon: Zap,
  },
  {
    title: "Meine Projekte",
    url: "/projects",
    icon: FolderOpen,
  },
  {
    title: "Produktbeschreibungen",
    url: "/product-creator",
    icon: ImagePlus,
  },
  {
    title: "API Credentials",
    url: "/credentials",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-bold text-foreground">PIMPilot</h2>
          <p className="text-xs text-muted-foreground">Produktmanagement</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`sidebar-${item.url.replace('/', '')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
