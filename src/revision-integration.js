import {
    createRevisionHistory,
} from "./revision-history.js";

const mountedRevisionHistories = new WeakMap();

function hasRevisionProvider(provider) {
    return Boolean(
        provider &&
        typeof provider.list === "function" &&
        typeof provider.view === "function" &&
        typeof provider.restore === "function"
    );
}

export function mountConfiguredRevisionHistory({
    drawer,
    options,
    documentObject,
    windowObject,
    onStatus = () => {},
    createHistory = createRevisionHistory,
}) {
    const historyAction = drawer.querySelector(
        "[data-cms-history-open]",
    );
    const container = drawer.querySelector(
        "[data-cms-history-content]",
    );

    if (!options || !hasRevisionProvider(options.provider)) {
        if (historyAction) {
            historyAction.disabled = true;
        }
        return null;
    }

    const existing = mountedRevisionHistories.get(drawer);
    if (existing) {
        return existing;
    }

    if (!container || !historyAction) {
        throw new Error(
            "CMS revision history requires the package-owned drawer history surface.",
        );
    }

    const hostStatus = options.onStatus;
    const controller = createHistory({
        ...options,
        container,
        documentObject,
        windowObject,
        onStatus(model) {
            onStatus(model);
            hostStatus?.(model);
        },
    });

    historyAction.disabled = false;
    mountedRevisionHistories.set(drawer, controller);

    return controller;
}
