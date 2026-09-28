import {
    getValueAtCmsPath,
    setValueAtCmsPath,
} from "./content-path.js";

function cloneCmsContent(value) {
    if (
        typeof structuredClone ===
        "function"
    ) {
        return structuredClone(value);
    }

    return JSON.parse(
        JSON.stringify(value),
    );
}

export function createCmsEditorState(
    initialContent,
    publishedContent = initialContent,
) {
    const originalContent =
        cloneCmsContent(initialContent);

    let publishedSnapshot =
        cloneCmsContent(publishedContent);

    let savedContent =
        cloneCmsContent(initialContent);

    return {
        getOriginalContent() {
            return originalContent;
        },

        getPublishedContent() {
            return publishedSnapshot;
        },

        setPublishedContent(content) {
            publishedSnapshot =
                cloneCmsContent(content);

            return publishedSnapshot;
        },

        getSavedContent() {
            return savedContent;
        },

        replaceSavedContent(content) {
            savedContent =
                cloneCmsContent(content);

            return savedContent;
        },

        getSavedValue(path) {
            return getValueAtCmsPath(
                savedContent,
                path,
            );
        },

        saveValue(path, value) {
            return setValueAtCmsPath(
                savedContent,
                path,
                value,
            );
        },

        saveValues(entries) {
            for (const { path, value } of entries) {
                setValueAtCmsPath(
                    savedContent,
                    path,
                    value,
                );
            }
        },

        revertToPublished() {
            savedContent =
                cloneCmsContent(
                    publishedSnapshot,
                );

            return savedContent;
        },
    };
}
