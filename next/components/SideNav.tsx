"use client";

import { useEffect, useRef, RefObject } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { NavLinks } from "@/app/components/layout/SideNavLinks";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/24/outline";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";

type SideNavProps = {
  isOpen: boolean;
  onClose: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
};

export default function SideNav({
  isOpen,
  onClose,
  menuButtonRef,
}: SideNavProps) {
  const sidenavRef = useRef<HTMLDivElement>(null);
  // ルート変更を検知
  const pathname = usePathname();
  // ログイン状態を取得
  const { user, logout } = useAuth();

  // 範囲外をクリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sidenavRef.current &&
        sidenavRef.current.contains(event.target as Node)
      ) {
        return;
      }
      if (
        menuButtonRef.current &&
        event.target instanceof Node &&
        menuButtonRef.current.contains(event.target)
      ) {
        return;
      }
      // それ以外の外側クリックなら閉じる
      onClose();
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, menuButtonRef]);

  // 現在の path から prefix を取り出す
  let section = pathname.split("/")[1] || "guest";
  // TODO
  if (!user) {
    section = "guest";
  }
  const items = NavLinks[section] || [];

  // TODO
  // 権限
  const role = user?.role ?? "user";

  // admin ページへのアクセス制限（必要に応じて）
  if (section === "admin" && role !== "admin") {
    return <aside className="p-4 text-red-500">管理者権限が必要です</aside>;
  }

  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await logout();
    } catch (err) {
      console.error("ログアウトに失敗しました:", err);
      throw err;
    }
  };

  return (
    <motion.aside
      ref={sidenavRef}
      initial={{ y: -20, opacity: 0 }} // 初期位置
      animate={{ y: 0, opacity: 1 }} // アニメーション後の位置
      exit={{ y: -20, opacity: 0 }} // アニメーション終了時の位置
      transition={{ duration: 0.1 }} // アニメーションの速さ
      className="fixed top-16 left-0 bg-primary/70 w-full p-4 text-white z-100"
      //className="fixed top-16 right-0 bg-primary/70 w-48 p-4 text-white shadow-lg z-100"
      //className="fixed top-16 right-0 w-48 h-full bg-primary/70 text-white shadow-lg z-10 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <Accordion type="multiple" className="w-full space-y-2">
        {items.map((item, index) =>
          item.children ? (
            <AccordionItem key={index} value={item.label}>
              <AccordionTrigger className="hover:no-underline">
                <div className="py-2 flex items-center gap-2 text-gray-300 hover:text-gray-50">
                  {item.icon && <item.icon className="h-5 w-5" />}
                  <p className="hidden md:block">{item.label}</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-6">
                <ul className="space-y-1">
                  {item.children.map((child, i) => (
                    <li key={i}>
                      <Link
                        href={child.href || "#"}
                        className="py-2 flex items-center gap-2 text-gray-300 hover:text-gray-50"
                      >
                        {child.icon && <child.icon className="h-5 w-5" />}
                        <p className="hidden md:block">{child.label}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ) : (
            <div key={index} className="ml-1">
              <Link
                href={item.href || "#"}
                className="py-2 flex items-center gap-2 text-gray-300 hover:text-gray-50"
              >
                {item.icon && <item.icon className="h-5 w-5" />}
                <p className="hidden md:block">{item.label}</p>
              </Link>
            </div>
          )
        )}
      </Accordion>
      {user && (
        <div className="ml-1">
          <form onSubmit={handleLogout}>
            <button className="py-2 flex items-center gap-2 text-gray-300 hover:text-gray-50 cursor-pointer">
              <ArrowLeftStartOnRectangleIcon className="h-5 w-5" />
              <div className="hidden md:block">Logout</div>
            </button>
          </form>
        </div>
      )}
    </motion.aside>
  );
}
