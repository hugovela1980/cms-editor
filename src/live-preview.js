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

const fileRestoreGeneration = new WeakMap();

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
    renderFilePreview = null,
    previewUrl = null,
    preserveFileRestore = false,
}) {
    const target = findCmsPreviewTarget(
        section,
        field.key,
    );

    if (!target) {
        return false;
    }

    if (field.type === CMS_FIELD_TYPES.FILE) {
        if (!preserveFileRestore) {
            fileRestoreGeneration.set(target, (fileRestoreGeneration.get(target) ?? 0) + 1);
        }
        if (typeof renderFilePreview !== "function") return false;
        renderFilePreview({
            section, target, field,
            value: value == null ? "" : String(value),
            previewUrl,
        });
        return true;
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
    renderFilePreview = null,
    resolveFileReference = null,
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

        if (field.type === CMS_FIELD_TYPES.FILE) {
            const target = findCmsPreviewTarget(section, field.key);
            if (!target) continue;
            const generation = (fileRestoreGeneration.get(target) ?? 0) + 1;
            fileRestoreGeneration.set(target, generation);
            applyCmsFieldPreview({ section, field, value: originalValue, renderFilePreview, preserveFileRestore: true });
            if (originalValue && typeof resolveFileReference === "function") {
                Promise.resolve().then(() => resolveFileReference({
                    sectionPath, schemaId: schema.id, fieldKey: field.key,
                    value: String(originalValue),
                })).then((metadata) => {
                    if (fileRestoreGeneration.get(target) !== generation) return;
                    applyCmsFieldPreview({
                        section, field, value: originalValue, renderFilePreview,
                        previewUrl: metadata?.previewUrl ?? null,
                        preserveFileRestore: true,
                    });
                }).catch(() => {});
            }
            continue;
        }
        applyCmsFieldPreview({
            section,
            field,
            value: originalValue,
            renderTextListPreview,
            renderFieldPreview,
            renderFilePreview,
        });
    }
}
