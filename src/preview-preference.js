const PREVIEW_STORAGE_KEY =
    "cms.showPreview";

const DEFAULT_PREVIEW_VALUE = true;

export function readCmsPreviewPreference(
    storage = window.localStorage,
) {
    try {
        const storedValue =
            storage.getItem(
                PREVIEW_STORAGE_KEY,
            );

        if (storedValue === null) {
            return DEFAULT_PREVIEW_VALUE;
        }

        return storedValue === "true";
    } catch {
        return DEFAULT_PREVIEW_VALUE;
    }
}

export function writeCmsPreviewPreference(
    enabled,
    storage = window.localStorage,
) {
    try {
        storage.setItem(
            PREVIEW_STORAGE_KEY,
            String(Boolean(enabled)),
        );
    } catch {
        // Preview still works for the current page
        // even if localStorage is unavailable.
    }
}