import {
    CMS_FIELD_TYPES,
} from "./field-types.js";

import {
    getValueAtCmsPath,
    joinCmsContentPath,
} from "./content-path.js";

import {
    findCmsPreviewTarget,
} from "./preview-target.js";

function applyValueToTarget({
    target,
    field,
    value,
}) {
    const normalizedValue =
        value === null ||
            value === undefined
            ? ""
            : String(value);

    if (
        field.type ===
            CMS_FIELD_TYPES.IMAGE
    ) {
        target.setAttribute(
            "src",
            normalizedValue,
        );

        return;
    }

    if (
        field.type ===
            CMS_FIELD_TYPES.URL ||
        field.type ===
            CMS_FIELD_TYPES.PAGE
    ) {
        target.setAttribute(
            "href",
            normalizedValue,
        );

        return;
    }

    target.textContent = normalizedValue;
}

export function applyCmsFieldPreview({
    section,
    field,
    value,
}) {
    const target = findCmsPreviewTarget(
        section,
        field.key,
    );

    if (!target) {
        return false;
    }

    applyValueToTarget({
        target,
        field,
        value,
    });

    return true;
}

export function restoreCmsSectionPreview({
    section,
    sectionPath,
    schema,
    siteContent,
}) {
    for (const field of schema.fields) {
        const fullPath = joinCmsContentPath(
            sectionPath,
            field.key,
        );

        const originalValue =
            getValueAtCmsPath(
                siteContent,
                fullPath,
            );

        applyCmsFieldPreview({
            section,
            field,
            value: originalValue,
        });
    }
}
