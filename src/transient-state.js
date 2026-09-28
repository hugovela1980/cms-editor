export const CMS_TRANSIENT_STATE_VERSION = 1;

export function createCmsTransientStateSnapshot({
    values = [],
    drawerOpen = false,
    openSectionPath = null,
    showPreview = true,
} = {}) {
    return {
        version:
            CMS_TRANSIENT_STATE_VERSION,

        values:
            values
                .filter(
                    (entry) =>
                        typeof entry?.path ===
                            "string" &&
                        entry.path.trim() !== "",
                )
                .map(
                    (entry) => ({
                        path:
                            entry.path,

                        value:
                            String(
                                entry.value ??
                                    "",
                            ),

                        ...(typeof entry.previewValue === "string"
                            ? { previewValue: entry.previewValue }
                            : {}),
                    }),
                ),

        drawerOpen:
            Boolean(drawerOpen),

        openSectionPath:
            typeof openSectionPath ===
                "string" &&
            openSectionPath !== ""
                ? openSectionPath
                : null,

        showPreview:
            Boolean(showPreview),
    };
}

export function isCmsTransientStateSnapshot(
    snapshot,
) {
    return Boolean(
        snapshot &&
        snapshot.version ===
            CMS_TRANSIENT_STATE_VERSION &&
        Array.isArray(
            snapshot.values,
        ) &&
        snapshot.values.every(
            (entry) =>
                typeof entry?.path ===
                    "string" &&
                typeof entry?.value ===
                    "string" &&
                (entry.previewValue === undefined ||
                    typeof entry.previewValue === "string"),
        ),
    );
}
