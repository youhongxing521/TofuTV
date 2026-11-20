import { useEffect, useState } from "react";
import type { OnboardingStep } from "@/stores/use-onboarding-store";

type HighlightOptions = {
    step: OnboardingStep;
    pathname: string;
    enabled: boolean;
    canvasId?: string;
    ready: boolean;
    hasVideoModel: boolean;
    inHistory: boolean;
    nodeId?: string;
    resultId?: string;
    taskId?: string;
};

function targetSelectors({ step, pathname, canvasId, ready, hasVideoModel, inHistory, nodeId, resultId, taskId }: HighlightOptions) {
    if (step === "model") {
        if (pathname !== "/settings") return ['[data-nav-id="settings:channels"]'];
        const modelPicker = 'section[aria-labelledby="default-video-title"]';
        const addService = '[data-onboarding="add-model-service"]';
        return hasVideoModel ? [modelPicker, addService] : [modelPicker + ":not(:has([disabled]))", addService];
    }
    if (step === "project") return canvasId ? [] : ['[data-nav-id="new"]', '[aria-label="新建画布创作"]'];
    if (step === "assets") {
        if (!inHistory) return ['[data-nav-id="assets"]'];
        return [taskId && `[data-onboarding-task-id="${CSS.escape(taskId)}"]`, ".generation-history-type-tabs"].filter((selector) => typeof selector === "string");
    }
    if (!canvasId) return ['[data-nav-id="new"]'];
    const nodeSelector = nodeId && `[data-node-id="${CSS.escape(nodeId)}"]`;
    if (step === "node") {
        if (ready && nodeSelector) return [nodeSelector];
        return ['[data-onboarding="video-option"]', '[data-onboarding="video-shortcut"]', '[aria-label="添加节点"]'];
    }
    if (step === "reference") {
        return ['[data-onboarding="video-all-references"]', '[aria-label="点选连线引用"]', nodeSelector].filter((selector) => typeof selector === "string");
    }
    if (resultId) return [`[data-node-id="${CSS.escape(resultId)}"]`];
    return ['.canvas-node-composer:has([aria-label="视频提示词"]) .canvas-node-composer-submit:not(:disabled)', '[aria-label="视频提示词"]', nodeSelector].filter((selector) => typeof selector === "string");
}

export function useGuideHighlight(options: HighlightOptions) {
    const { enabled, step } = options;
    const selectorKey = enabled ? targetSelectors(options).join("\n") : "";
    const [highlight, setHighlight] = useState<{ key: string; rect: DOMRect } | null>(null);

    useEffect(() => {
        if (!selectorKey) return;
        const selectors = selectorKey.split("\n");
        let frame = 0;
        let target: HTMLElement | undefined;
        const resize = new ResizeObserver(schedule);
        function update() {
            frame = 0;
            const next = selectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector))).find((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width > 2 && rect.height > 2 && (step === "model" || (rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth));
            });
            if (next !== target) {
                if (target) resize.unobserve(target);
                target = next;
                if (next) {
                    resize.observe(next);
                    if (step === "model") next.scrollIntoView({ block: "nearest", inline: "nearest" });
                }
            }
            const rect = next?.getBoundingClientRect();
            setHighlight((previous) => {
                if (!rect || rect.bottom <= 0 || rect.top >= window.innerHeight) return null;
                if (previous?.key === selectorKey && previous.rect.x === rect.x && previous.rect.y === rect.y && previous.rect.width === rect.width && previous.rect.height === rect.height) return previous;
                return { key: selectorKey, rect };
            });
        }
        function schedule() {
            if (!frame) frame = window.requestAnimationFrame(update);
        }
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
        window.addEventListener("resize", schedule);
        window.addEventListener("scroll", schedule, true);
        document.addEventListener("transitionend", schedule, true);
        document.addEventListener("input", schedule, true);
        document.addEventListener("pointerup", schedule, true);
        schedule();
        return () => {
            observer.disconnect();
            resize.disconnect();
            window.removeEventListener("resize", schedule);
            window.removeEventListener("scroll", schedule, true);
            document.removeEventListener("transitionend", schedule, true);
            document.removeEventListener("input", schedule, true);
            document.removeEventListener("pointerup", schedule, true);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [selectorKey, step]);

    return enabled && highlight?.key === selectorKey ? highlight.rect : null;
}
