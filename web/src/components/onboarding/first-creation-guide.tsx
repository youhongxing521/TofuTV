import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "antd";
import { Check, ChevronDown, Copy, GripVertical, HelpCircle, X } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import {
    channelHasGenerationCredential,
    configuredModelMatchesCapability,
    modelOptionLabel,
    resolveModelChannel,
    useConfigStore,
} from "@/stores/use-config-store";
import { useOnboardingStore, onboardingSteps, type OnboardingStep } from "@/stores/use-onboarding-store";
import { CanvasNodeType } from "@/types/canvas";
import { useGuideHighlight } from "./use-guide-highlight";
import "./first-creation-guide.css";

const modelSettings = "/settings?section=channels";
const generationHistory = "/assets?tab=history";
const openGuideEvent = "beeftv:open-guide";
const sample = "雨后的城市街道，地面映着暖橙色路灯。一辆黄色有轨电车从右向左驶过，镜头缓慢向前推进，保持同一个镜头。";
const moveGuideKeys: Partial<Record<string, [number, number]>> = {
    ArrowLeft: [-20, 0],
    ArrowRight: [20, 0],
    ArrowUp: [0, -20],
    ArrowDown: [0, 20],
};

const lessons = {
    model: { title: "选择视频模型", description: "在「模型配置」里添加模型服务，拉取模型，再选择「默认视频模型」。" },
    project: { title: "打开创作画布", description: "点击左侧「新建项目」，也可以打开已有项目，进入一张画布。" },
    node: { title: "添加视频节点", description: "点击画布的「＋」，选择「视频」。也可以直接点左侧的视频图标。" },
    reference: { title: "添加参考图（可选）", description: "把图片拖到画布，选中视频节点，点「点选连线」，再点击图片。" },
    generate: { title: "生成第一条视频", description: "选中视频节点，输入画面和镜头动作。确认模型、比例和时长，再点击右下角的「生成」箭头。" },
    assets: { title: "查看与下载成片", description: "生成完成后，可以直接在画布预览和下载，也可以在「资产 → 生成历史」里找到成片。" },
} satisfies Record<OnboardingStep, { title: string; description: string }>;

export function OnboardingEntry({ compact = false }: { compact?: boolean }) {
    return (
        <button type="button" className={`app-workspace-nav-link first-creation-entry${compact ? " is-collapsed" : ""}`} aria-label="新手引导" title="新手引导" onClick={() => window.dispatchEvent(new Event(openGuideEvent))}>
            <span className="app-workspace-nav-main flex min-w-0 items-center gap-2.5">
                <span className="app-workspace-nav-icon" aria-hidden><HelpCircle className="size-4 shrink-0" strokeWidth={1.8} /></span>
                {!compact && <span className="app-workspace-nav-title truncate">新手引导</span>}
            </span>
        </button>
    );
}

export function FirstCreationGuide() {
    const guide = useOnboardingStore();
    const config = useConfigStore((state) => state.config);
    const projects = useCanvasStore((state) => state.projects);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    const [welcome, setWelcome] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [notice, setNotice] = useState("");
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const drag = useRef<{ x: number; y: number } | null>(null);
    const step = onboardingSteps[guide.step];
    const lesson = lessons[step];
    const active = guide.status === "active" && !welcome;
    const canvasId = pathname.match(/^\/canvas\/([^/]+)$/)?.[1];
    const project = projects.find((item) => item.id === (canvasId ?? guide.projectId));
    const node = project?.id === guide.projectId ? project?.nodes.find((item) => item.id === guide.nodeId) : undefined;
    const result = node && project?.nodes.find((item) =>
        item.type === CanvasNodeType.Video &&
        Boolean(item.metadata?.content || item.metadata?.storageKey) &&
        item.metadata?.resultOrigin === "generated" &&
        (item.id === node.id || item.metadata.generatedFromNodeId === node.id),
    );
    const canvasPath = project ? `/canvas/${encodeURIComponent(project.id)}` : "";
    const inHistory = pathname === "/assets" && new URLSearchParams(search).get("tab") === "history";
    const videoChannel = resolveModelChannel(config, config.videoModel);
    const hasVideoModel = Boolean(videoChannel.enabled !== false && videoChannel.baseUrl.trim() &&
        configuredModelMatchesCapability(config, config.videoModel, "video") &&
        (videoChannel.hasApiKey || channelHasGenerationCredential(videoChannel, config.videoModel)));
    const ready = {
        model: hasVideoModel,
        project: Boolean(project),
        node: Boolean(node),
        reference: node?.metadata?.videoEditOperation === "reference_to_video" && Boolean(project?.connections.some((connection) =>
            connection.toNodeId === node.id && project.nodes.some((item) => item.id === connection.fromNodeId && item.type === CanvasNodeType.Image),
        )),
        generate: Boolean(result),
        assets: inHistory,
    }[step];

    useEffect(() => {
        if (hydrated && !projects.length && pathname === "/" && guide.status === "new") setWelcome(true);
    }, [hydrated, projects.length, pathname, guide.status]);

    useEffect(() => {
        const open = () => {
            setCollapsed(false);
            if (guide.status !== "active") setWelcome(true);
        };
        window.addEventListener(openGuideEvent, open);
        return () => window.removeEventListener(openGuideEvent, open);
    }, [guide.status]);

    useEffect(() => {
        if (!active || !canvasId || !project) return;
        const savedNode = project.id === guide.projectId && node?.type === CanvasNodeType.Video ? node : undefined;
        const latestVideo = project.nodes.findLast((item) => item.type === CanvasNodeType.Video && item.metadata?.nodeRole !== "result");
        const videoNode = step === "node" ? latestVideo ?? savedNode : savedNode ?? latestVideo;
        if (guide.projectId !== project.id || guide.nodeId !== videoNode?.id) {
            guide.bind({ projectId: project.id, nodeId: videoNode?.id });
        }
    }, [active, canvasId, project, node, step, guide.projectId, guide.nodeId, guide.bind]);

    useEffect(() => { setNotice(""); }, [step, guide.status]);
    useEffect(() => {
        const reset = () => setPosition(null);
        window.addEventListener("resize", reset);
        return () => window.removeEventListener("resize", reset);
    }, []);

    const highlight = useGuideHighlight({
        step, pathname, enabled: active && !collapsed, canvasId,
        ready: Boolean(ready), hasVideoModel, inHistory,
        nodeId: node?.id, resultId: result?.id, taskId: result?.metadata?.taskId,
    });
    const goTo = (route: string) => {
        if (`${pathname}${search}` !== route && pathname !== route) navigate(route);
    };
    const goToLesson = (next: OnboardingStep) => {
        if (next === "model") goTo(modelSettings);
        else if (next === "assets") goTo(generationHistory);
        else goTo(canvasPath || "/project");
    };
    const changeStep = (direction: -1 | 1) => {
        const next = onboardingSteps[guide.step + direction];
        if (direction === -1) guide.back();
        else guide.advance(!ready);
        if (next) goToLesson(next);
    };
    const start = (resume: boolean) => {
        if (resume) guide.begin();
        else guide.restart();
        setWelcome(false);
        setPosition(null);
        if (resume) goToLesson(step);
        else if (!hasVideoModel) goTo(modelSettings);
    };
    const dismissWelcome = () => {
        setWelcome(false);
        if (guide.status === "new") guide.pause();
    };
    const copyExample = async () => {
        try {
            await navigator.clipboard.writeText(sample);
            setNotice("已复制，粘贴到视频提示词输入框。");
        } catch {
            setNotice("可选中上方示例并手动复制。");
        }
    };
    const movePanel = (bounds: DOMRect, x: number, y: number) => {
        setPosition({
            x: Math.max(8, Math.min(window.innerWidth - bounds.width - 8, x)),
            y: Math.max(8, Math.min(window.innerHeight - bounds.height - 8, y)),
        });
    };
    const dragPanel = (event: PointerEvent<HTMLButtonElement>) => {
        const bounds = event.currentTarget.closest("aside")?.getBoundingClientRect();
        if (drag.current && bounds) movePanel(bounds, event.clientX - drag.current.x, event.clientY - drag.current.y);
    };
    const resumeAvailable = guide.status === "paused" && (guide.step > 0 || Boolean(guide.projectId));
    const nextLabel = step === "assets" ? "完成引导" : step === "reference" && !ready ? "跳过参考图" : step === "generate" && !ready ? "跳过生成" : "下一步";
    const returnToCanvas = () => {
        goTo(canvasPath);
        guide.advance(!ready);
    };

    return (
        <>
            <AppModal open={welcome} title="在 TofuTV 生成第一条视频" onCancel={dismissWelcome} width={440}
                footer={[
                    <Button key="later" onClick={dismissWelcome}>稍后</Button>,
                    ...(resumeAvailable ? [<Button key="restart" onClick={() => start(false)}>从头开始</Button>] : []),
                    <Button key="start" type="primary" onClick={() => start(resumeAvailable)}>{resumeAvailable ? "继续引导" : "开始引导"}</Button>,
                ]}>
                <p className="first-creation-intro">从配置模型、添加视频节点，到用角色参考图生成视频。你可以跳过参考图和生成，先熟悉操作位置。</p>
            </AppModal>
            {active && (
                <aside
                    className={`first-creation-guide${canvasId ? " is-canvas" : ""}${collapsed ? " is-collapsed" : ""}`}
                    style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}
                    aria-label="新手引导" data-step={step} data-canvas-no-zoom
                    onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}
                >
                    <div className="first-creation-heading">
                        <button type="button" className="first-creation-move" aria-label="移动引导卡，可拖动或使用方向键" title="移动引导卡"
                            onPointerDown={(event) => {
                                const bounds = event.currentTarget.closest("aside")?.getBoundingClientRect();
                                if (event.button !== 0 || !bounds) return;
                                drag.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
                                event.currentTarget.setPointerCapture(event.pointerId);
                            }}
                            onPointerMove={dragPanel} onLostPointerCapture={() => { drag.current = null; }}
                            onKeyDown={(event) => {
                                const delta = moveGuideKeys[event.key];
                                const bounds = event.currentTarget.closest("aside")?.getBoundingClientRect();
                                if (!delta || !bounds) return;
                                event.preventDefault();
                                event.stopPropagation();
                                movePanel(bounds, bounds.left + delta[0], bounds.top + delta[1]);
                            }}>
                            <GripVertical size={15} aria-hidden />
                        </button>
                        <button type="button" className="first-creation-expand" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
                            <span>{collapsed ? lesson.title : `新手引导 · ${guide.step + 1} / ${onboardingSteps.length}`}</span>
                            <ChevronDown size={15} aria-hidden />
                        </button>
                        <button type="button" className="first-creation-close" aria-label="暂停引导" title="暂停引导" onClick={guide.pause}><X size={17} aria-hidden /></button>
                    </div>
                    {!collapsed && (
                        <>
                            <div aria-live="polite">
                                <h2>{lesson.title}{ready && <Check size={16} className="first-creation-check" aria-label="已完成" />}</h2>
                                <p>{step === "model" && hasVideoModel ? <>当前默认视频模型是 <strong>{modelOptionLabel(config, config.videoModel)}</strong>，可以开始创作。</> : lesson.description}</p>
                                {step === "model" && <p>可使用自己的模型渠道。只有选用上游算力时才需要连接它。</p>}
                                {step === "reference" && <p>如果模型支持「全能参考」，选它就能只参考人物或风格。确认「首帧」「尾帧」角标消失。需要指定开场或结尾画面时，选「首尾帧」。</p>}
                                {step === "generate" && !result && <p>生成费用以所选模型为准。</p>}
                                {step === "generate" && result && <p>成片已在画布中，可前往生成历史查看。</p>}
                            </div>
                            {!canvasId && (step === "node" || step === "reference" || step === "generate") && (
                                <button type="button" className="first-creation-link" onClick={() => goTo(canvasPath || "/project")}>{canvasPath ? "打开创作画布" : "前往项目页"}</button>
                            )}
                            {step === "model" && pathname !== "/settings" && <button type="button" className="first-creation-link" onClick={() => goTo(modelSettings)}>打开模型配置</button>}
                            {step === "generate" && !result && (
                                <div className="first-creation-example">
                                    <p>{sample}</p>
                                    <button type="button" className="first-creation-link" onClick={() => void copyExample()}><Copy size={14} aria-hidden />复制示例提示词</button>
                                    {notice && <p role="status">{notice}</p>}
                                </div>
                            )}
                            <div className="first-creation-footer">
                                <Button size="small" disabled={guide.step === 0} onClick={() => changeStep(-1)}>上一步</Button>
                                {step === "assets" && canvasPath && <Button size="small" onClick={returnToCanvas}>返回画布</Button>}
                                <Button size="small" type="primary" onClick={() => changeStep(1)}>{nextLabel}</Button>
                            </div>
                        </>
                    )}
                </aside>
            )}
            {active && !collapsed && highlight && (
                <div className="first-creation-highlight" aria-hidden style={{ left: highlight.left - 4, top: highlight.top - 4, width: highlight.width + 8, height: highlight.height + 8 }} />
            )}
        </>
    );
}
