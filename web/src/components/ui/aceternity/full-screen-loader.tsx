import { useEffect, useState } from "react";

import { resolveEmbeddedAssetUrl } from "@/lib/embedded-runtime";
import { PRODUCT_STARTUP_IMAGE_URL } from "@/lib/product-brand";
import { cn } from "@/lib/utils";

type FullScreenLoaderProps = {
    label?: string;
    detail?: string;
    className?: string;
};

export function FullScreenLoader({ label = "正在恢复工作区", detail = "同步账号、模型和项目数据", className }: FullScreenLoaderProps) {
    return (
        <div
            data-full-screen-loader
            role="status"
            aria-live="polite"
            aria-label={`${label}，${detail}`}
            className={cn("full-screen-loader", className)}
        >
            <img className="dofu-startup-art" src={resolveEmbeddedAssetUrl(PRODUCT_STARTUP_IMAGE_URL)} alt="" draggable={false} />
        </div>
    );
}

export function WorkspaceRouteLoader({ label = "正在打开页面" }: { label?: string }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(true), 140);
        return () => window.clearTimeout(timer);
        }, []);

    return (
        <section data-workspace-route-loader className={cn("workspace-route-loader", visible && "is-visible")} role="status" aria-live="polite" aria-label={label}>
            <div className="workspace-route-loader-content">
                <span className="beeftv-loading-logo is-compact" aria-hidden="true" />
                <span>{label}</span>
            </div>
        </section>
    );
}
