import { Hand, Image, MousePointer2, Type, Video } from "lucide-react";

import { CanvasNodeType, type CanvasToolMode } from "@/types/canvas";

const nodeTools = [
    { type: CanvasNodeType.Text, label: "添加文本节点", icon: Type },
    { type: CanvasNodeType.Image, label: "添加图片节点", icon: Image },
    { type: CanvasNodeType.Video, label: "添加视频节点", icon: Video },
] as const;

export function CanvasQuickTools({ tool, onToolChange, onAddNode }: {
    tool: CanvasToolMode;
    onToolChange: (tool: CanvasToolMode) => void;
    onAddNode: (type: typeof nodeTools[number]["type"]) => void;
}) {
    return (
        <div role="toolbar" aria-label="画布快捷工具" data-canvas-no-zoom className="dofu-canvas-quick-tools">
            <button type="button" aria-label="选择节点" title="选择节点（V）" aria-pressed={tool === "box-select"} onClick={() => onToolChange("box-select")}>
                <MousePointer2 size={18} aria-hidden="true" />
            </button>
            {nodeTools.map(({ type, label, icon: Icon }) => (
                <button key={type} type="button" aria-label={label} title={label} onClick={() => onAddNode(type)}>
                    <Icon size={18} aria-hidden="true" />
                </button>
            ))}
            <button type="button" aria-label="平移画布" title="平移画布（H）" aria-pressed={tool === "move"} onClick={() => onToolChange("move")}>
                <Hand size={18} aria-hidden="true" />
            </button>
        </div>
    );
}
