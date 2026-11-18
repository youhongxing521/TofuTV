import { ArrowLeft, FolderGit2, MessagesSquare, Stethoscope } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { aceternityMotion } from "@/lib/aceternity-motion";
import { cn } from "@/lib/utils";
import { PRODUCT_REPOSITORY_URL } from "@/lib/product-brand";

export function WorkspaceSidebarSocialLinks({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const backRef = useRef<HTMLButtonElement>(null);
    const wasExpanded = useRef(false);
    const reducedMotion = useReducedMotion();
    const active = expanded && !collapsed;
    const transition = { duration: reducedMotion ? 0 : aceternityMotion.duration.state, ease: aceternityMotion.easing.enter };

    useEffect(() => {
        if (collapsed) {
            wasExpanded.current = false;
            setExpanded(false);
            return;
        }
        if (wasExpanded.current === active) return;
        wasExpanded.current = active;
        (active ? backRef : triggerRef).current?.focus({ preventScroll: true });
    }, [active, collapsed]);

    const close = () => setExpanded(false);

    return (
        <div className="app-workspace-sidebar-contact-row" onKeyDown={(event) => {
            if (active && event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        }}>
            <motion.button
                ref={triggerRef}
                type="button"
                className={cn("app-workspace-nav-link group relative flex w-full items-center gap-2 rounded-[var(--r-md)] text-left", collapsed && "is-collapsed")}
                aria-label="项目与反馈"
                title="项目与反馈"
                aria-expanded={active}
                aria-hidden={active}
                inert={active}
                initial={false}
                animate={{ opacity: active ? 0 : 1, x: reducedMotion ? 0 : active ? -8 : 0 }}
                transition={transition}
                onClick={() => {
                    if (collapsed) onExpand();
                    setExpanded(true);
                }}
            >
                <span className="app-workspace-nav-main flex min-w-0 items-center gap-2.5">
                    <span className="app-workspace-nav-icon" aria-hidden="true"><MessagesSquare className="size-4" strokeWidth={1.8} /></span>
                    {!collapsed ? <span className="app-workspace-nav-title truncate">项目与反馈</span> : null}
                </span>
            </motion.button>
            <motion.div
                className="app-workspace-social-links"
                role="group"
                aria-label="项目与反馈"
                aria-hidden={!active}
                inert={!active}
                initial={false}
                animate={{ opacity: active ? 1 : 0, x: reducedMotion ? 0 : active ? 0 : 8 }}
                transition={transition}
            >
                <button ref={backRef} type="button" className="app-workspace-social-action" aria-label="收起项目与反馈" title="收起项目与反馈" onClick={close}>
                    <ArrowLeft aria-hidden="true" strokeWidth={1.8} />
                </button>
                <a className="app-workspace-social-action" href={PRODUCT_REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label="打开 TofuTV Gitee 仓库" title="TofuTV Gitee 仓库">
                    <FolderGit2 aria-hidden="true" />
                </a>
                <Link className="app-workspace-social-action" to="/settings?section=diagnostics" onClick={close} aria-label="问题诊断" title="问题诊断">
                    <Stethoscope aria-hidden="true" />
                </Link>
            </motion.div>
        </div>
    );
}
