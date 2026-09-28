import {
    joinCmsContentPath,
} from "./content-path.js";

function normalizeComparableValue(
    value,
) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value);
}

function getControlPath(
    control,
) {
    const sectionPath =
        control.dataset
            .cmsSectionPath;

    const fieldKey =
        control.dataset
            .cmsFieldKey;

    if (
        !sectionPath ||
        !fieldKey
    ) {
        return null;
    }

    return joinCmsContentPath(
        sectionPath,
        fieldKey,
    );
}

export function collectCmsEditorValues({
    editingRoot,
}) {
    const values = [];

    for (
        const control
        of editingRoot.querySelectorAll(
            "[data-cms-field-key]",
        )
    ) {
        const path =
            getControlPath(
                control,
            );

        if (!path) {
            continue;
        }

        values.push({
            path,

            value:
                normalizeComparableValue(
                    control.value,
                ),
        });
    }

    return values;
}

export function isCmsEditorControlChanged({
    control,
    editorState,
}) {
    const path =
        getControlPath(
            control,
        );

    if (!path) {
        return false;
    }

    return (
        normalizeComparableValue(
            control.value,
        ) !==
        normalizeComparableValue(
            editorState.getSavedValue(
                path,
            ),
        )
    );
}

export function syncCmsEditorControlChangeState({
    control,
    editorState,
}) {
    const changed =
        isCmsEditorControlChanged({
            control,
            editorState,
        });

    if (changed) {
        control.dataset
            .cmsUnsavedChange =
            "true";
    } else {
        delete control.dataset
            .cmsUnsavedChange;
    }

    return changed;
}

export function syncCmsEditorChangedFields({
    editingRoot,
    editorState,
}) {
    let changedCount = 0;

    for (
        const control
        of editingRoot.querySelectorAll(
            "[data-cms-field-key]",
        )
    ) {
        if (
            syncCmsEditorControlChangeState({
                control,
                editorState,
            })
        ) {
            changedCount += 1;
        }
    }

    return changedCount;
}

export function hasCmsEditorChanges({
    editingRoot,
    editorState,
}) {
    return collectCmsEditorValues({
        editingRoot,
    }).some(
        ({ path, value }) =>
            value !==
            normalizeComparableValue(
                editorState.getSavedValue(
                    path,
                ),
            ),
    );
}
