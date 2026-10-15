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

import {
    isSafeCmsPreviewAttribute,
    isSafeCmsPreviewAttributeValue,
} from "./preview-attributes.js";

function applyValueToTarget({
    section,
    target,
    field,
    value,
    renderFieldPreview,
}) {
    const normalizedValue =
        value === null ||
            value === undefined
            ? ""
            : String(value);

    const previewAttribute =
        field.previewAttribute
            ?.toLowerCase();

    if (previewAttribute) {
        if (
            !isSafeCmsPreviewAttribute(previewAttribute) ||
            !isSafeCmsPreviewAttributeValue(
                previewAttribute,
                normalizedValue,
            )
        ) {
            return false;
        }

        target.setAttribute(
            previewAttribute,
            normalizedValue,
        );

        return true;
    }

    if (
        field.type ===
            CMS_FIELD_TYPES.IMAGE
    ) {
        if (!isSafeCmsPreviewAttributeValue("src", normalizedValue)) {
            return false;
        }

        if (normalizedValue === "") {
            target.removeAttribute("src");
            return true;
        }

        target.setAttribute(
            "src",
            normalizedValue,
        );

        return true;
    }

    if (
        field.type ===
            CMS_FIELD_TYPES.URL ||
        field.type ===
            CMS_FIELD_TYPES.PAGE
    ) {
        if (!isSafeCmsPreviewAttributeValue("href", normalizedValue)) {
            return false;
        }

        target.setAttribute(
            "href",
            normalizedValue,
        );

        return true;
    }

    if (
        (field.type === CMS_FIELD_TYPES.TEXT ||
            field.type === CMS_FIELD_TYPES.TEXTAREA) &&
        typeof renderFieldPreview === "function" &&
        renderFieldPreview({
            section,
            target,
            field,
            value: normalizedValue,
        }) === true
    ) {
        return true;
    }

    target.textContent = normalizedValue;

    return true;
}

export function applyCmsFieldPreview({
    section,
    field,
    value,
    renderTextListPreview = null,
    renderFieldPreview = null,
}) {
    const target = findCmsPreviewTarget(
        section,
        field.key,
    );

    if (!target) {
        return false;
    }

    if (field.type === CMS_FIELD_TYPES.TEXT_LIST) {
        const listValue = value === undefined || value === null ? [] : value;
        if (!Array.isArray(listValue) || listValue.some((item) => typeof item !== "string") ||
            typeof renderTextListPreview !== "function") return false;
        renderTextListPreview({ section, target, field, value: [...listValue] });
        return true;
    }

    return applyValueToTarget({
        section,
        target,
        field,
        value,
        renderFieldPreview,
    });
}

export function restoreCmsSectionPreview({
    section,
    sectionPath,
    schema,
    siteContent,
    renderTextListPreview = null,
    renderFieldPreview = null,
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
            renderTextListPreview,
            renderFieldPreview,
        });
    }
}
