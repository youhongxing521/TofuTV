import { create } from "zustand";
import { scopedLocalStorage, onStorageNamespaceChange } from "@/lib/user-scope";

export const onboardingSteps = ["model", "project", "node", "reference", "generate", "assets"] as const;
export type OnboardingStep = typeof onboardingSteps[number];
type Progress = {
    status: "new" | "active" | "paused" | "finished";
    step: number;
    skipped: OnboardingStep[];
    projectId?: string;
    nodeId?: string;
};
const key = "beeftv:first-creation:v2";
const initial: Progress = { status: "new", step: 0, skipped: [] };
function read(): Progress {
    try {
        const value = JSON.parse(scopedLocalStorage.getItem(key) || "null");
        if (!value || !["new", "active", "paused", "finished"].includes(value.status) || !Number.isInteger(value.step) || value.step < 0 || value.step >= onboardingSteps.length) return { ...initial };
        return {
            status: value.status === "active" ? "paused" : value.status,
            step: value.step,
            skipped: Array.isArray(value.skipped) ? value.skipped.filter((step: OnboardingStep) => onboardingSteps.includes(step)) : [],
            projectId: typeof value.projectId === "string" ? value.projectId : undefined,
            nodeId: typeof value.nodeId === "string" ? value.nodeId : undefined,
        };
    } catch { return { ...initial }; }
}
type Store = Progress & {
    begin: () => void;
    pause: () => void;
    advance: (skip?: boolean) => void;
    back: () => void;
    bind: (values: Partial<Pick<Progress, "projectId" | "nodeId">>) => void;
    restart: () => void;
};
export const useOnboardingStore = create<Store>((set, get) => {
    const save = (patch: Partial<Progress>) => {
        const { status, step, skipped, projectId, nodeId } = { ...get(), ...patch };
        const progress = { status, step, skipped, projectId, nodeId };
        scopedLocalStorage.setItem(key, JSON.stringify(progress));
        set(progress);
    };
    return {
        ...read(),
        begin: () => save({ status: "active" }),
        pause: () => save({ status: "paused" }),
        advance: (skip = false) => {
            const state = get();
            if (state.status !== "active") return;
            save({ step: Math.min(state.step + 1, onboardingSteps.length - 1), status: state.step === onboardingSteps.length - 1 ? "finished" : "active", skipped: skip ? [...new Set([...state.skipped, onboardingSteps[state.step]])] : state.skipped.filter((item) => item !== onboardingSteps[state.step]) });
        },
        back: () => { if (get().status === "active") save({ step: Math.max(0, get().step - 1) }); },
        bind: (values) => save(values),
        restart: () => save({ ...initial, status: "active", projectId: undefined, nodeId: undefined }),
    };
});
// 第一次启动时命名空间从 guest 切到工作区 ID，引导进度要按新命名空间重读。
onStorageNamespaceChange(() => useOnboardingStore.setState(read()));
