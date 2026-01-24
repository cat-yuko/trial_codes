import {
  ArrowLeftEndOnRectangleIcon,
  ArrowLeftStartOnRectangleIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CubeIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ChevronDownIcon,
  FolderIcon,
  HomeIcon,
  PencilSquareIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";

export type NavItem = {
  label: string;
  href?: string; // ? -> 省略可能
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>; // ? -> 省略可能
  children?: NavItem[]; // ? -> 省略可能
};

export const NavLinks: Record<string, NavItem[]> = {
  guest: [
    { label: "Top", href: "/", icon: CubeIcon },
    {
      label: "Login",
      href: "/login",
      icon: ArrowLeftEndOnRectangleIcon,
    },
    { label: "Register", href: "/register", icon: PencilSquareIcon },
  ],
  dashboard: [
    { label: "Home", href: "/dashboard", icon: HomeIcon },
    {
      label: "Files",
      icon: ChevronDownIcon,
      children: [
        {
          label: "List",
          href: "/dashboard/files",
          icon: PhotoIcon,
        },
        {
          label: "Upload",
          href: "/dashboard/upload",
          icon: ArrowUpTrayIcon,
        },
        {
          label: "Download",
          href: "/dashboard/download",
          icon: ArrowDownTrayIcon,
        },
      ],
    },
    {
      label: "Chat",
      href: "/dashboard/chat",
      icon: ChatBubbleOvalLeftEllipsisIcon,
    },
  ],
  settings: [
    { label: "プロフィール", href: "/settings/profile" },
    { label: "通知設定", href: "/settings/notifications" },
  ],
  admin: [
    { label: "ユーザー管理", href: "/admin/users" },
    { label: "ログ監視", href: "/admin/logs" },
  ],
};
