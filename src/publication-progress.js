export const CMS_PUBLICATION_STAGES = Object.freeze([
    "preparing",
    "creating-version",
    "updating-live",
    "confirming-live",
    "confirmed",
]);

const PUBLICATION_STAGE_LABELS = Object.freeze({
    preparing: "Preparing publication",
    "creating-version": "Creating website version",
    "updating-live": "Updating live website",
    "confirming-live": "Confirming live website",
    confirmed: "Website published and live",
});

const STAGE_INDEX = new Map(
    CMS_PUBLICATION_STAGES.map((stage, index) => [stage, index]),
);

const HOST_REPORTABLE_STAGES = new Set([
    "creating-version",
    "updating-live",
    "confirming-live",
]);

export function createCmsPublicationProgress({
    statusSurface,
}) {
    let sequence = 0;
    let activeOperation = null;
    let completedRetained = false;

    function render(operation, { successful = false } = {}) {
        const activeIndex = STAGE_INDEX.get(operation.stage);
        statusSurface.set("publication-progress", {
            message: successful
                ? "Website published"
                : "Publishing website…",
            supporting: successful
                ? "Your website is published and live."
                : "Publication continues in the background.",
            priority: successful ? 20 : 85,
            progress: !successful,
            inlineDetails: {
                id: `publication-${operation.id}`,
                label: "Publication progress",
                steps: CMS_PUBLICATION_STAGES.map((stage, index) => ({
                    stage,
                    label: PUBLICATION_STAGE_LABELS[stage],
                    state: successful || index < activeIndex
                        ? "completed"
                        : index === activeIndex
                            ? "active"
                            : "pending",
                })),
            },
        });
    }

    function start() {
        const operation = {
            id: ++sequence,
            stage: "preparing",
            active: true,
        };
        activeOperation = operation;
        completedRetained = false;
        render(operation);

        return {
            id: operation.id,
            reportProgress(stage) {
                return report(operation, stage);
            },
        };
    }

    function report(operation, stage) {
        if (
            !operation.active ||
            activeOperation !== operation ||
            !HOST_REPORTABLE_STAGES.has(stage)
        ) {
            return false;
        }

        if (STAGE_INDEX.get(stage) < STAGE_INDEX.get(operation.stage)) {
            return false;
        }

        operation.stage = stage;
        render(operation);
        return true;
    }

    function succeed(handle) {
        if (!activeOperation || activeOperation.id !== handle.id) {
            return false;
        }

        activeOperation.stage = "confirmed";
        activeOperation.active = false;
        render(activeOperation, { successful: true });
        activeOperation = null;
        completedRetained = true;
        return true;
    }

    function fail(handle) {
        if (!activeOperation || activeOperation.id !== handle.id) {
            return false;
        }

        activeOperation.active = false;
        activeOperation = null;
        completedRetained = false;
        statusSurface.set("publication-progress", null);
        return true;
    }

    function clearCompleted() {
        if (activeOperation || !completedRetained) {
            return false;
        }

        completedRetained = false;
        statusSurface.set("publication-progress", null);
        return true;
    }

    return { start, succeed, fail, clearCompleted };
}
