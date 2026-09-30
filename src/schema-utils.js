import {
    CMS_FIELD_TYPES,
    CMS_SUPPORTED_FIELD_TYPES,
} from "./field-types.js";

import {
    isSafeCmsPreviewAttribute,
} from "./preview-attributes.js";

function assertNonEmptyString(value, message) {
    if (
        typeof value !== "string" ||
        value.trim() === ""
    ) {
        throw new Error(message);
    }
}

function assertValidCmsOptions(
    field,
    schemaId,
) {
    if (
        field.type !==
        CMS_FIELD_TYPES.PAGE
    ) {
        return;
    }

    if (
        !Array.isArray(field.options) ||
        field.options.length === 0
    ) {
        throw new Error(
            `CMS page field "${schemaId}.${field.key}" requires at least one option.`,
        );
    }

    const values = new Set();

    for (const option of field.options) {
        if (
            !option ||
            typeof option !== "object"
        ) {
            throw new Error(
                `CMS page field "${schemaId}.${field.key}" contains an invalid option.`,
            );
        }

        assertNonEmptyString(
            option.label,
            `CMS page field "${schemaId}.${field.key}" contains an option without a valid label.`,
        );

        assertNonEmptyString(
            option.value,
            `CMS page field "${schemaId}.${field.key}" contains an option without a valid value.`,
        );

        if (values.has(option.value)) {
            throw new Error(
                `CMS page field "${schemaId}.${field.key}" contains duplicate option value "${option.value}".`,
            );
        }

        values.add(option.value);
    }
}

function assertValidCmsImageOptions(
    field,
    schemaId,
) {
    if (
        field.type !==
        CMS_FIELD_TYPES.IMAGE
    ) {
        return;
    }

    if (
        !Array.isArray(field.accept) ||
        field.accept.length === 0 ||
        field.accept.some(
            (value) =>
                typeof value !== "string" ||
                !value.startsWith("image/"),
        )
    ) {
        throw new Error(
            `CMS image field "${schemaId}.${field.key}" requires image MIME types in accept metadata.`,
        );
    }

    if (
        !Number.isInteger(field.maxBytes) ||
        field.maxBytes <= 0
    ) {
        throw new Error(
            `CMS image field "${schemaId}.${field.key}" requires a positive maxBytes value.`,
        );
    }
}

export function assertValidCmsField(field, schemaId) {
    if (!field || typeof field !== "object") {
        throw new Error(
            `CMS schema "${schemaId}" contains an invalid field.`,
        );
    }

    assertNonEmptyString(
        field.key,
        `CMS schema "${schemaId}" contains a field without a valid key.`,
    );

    assertNonEmptyString(
        field.label,
        `CMS field "${schemaId}.${field.key}" requires a label.`,
    );

    if (!CMS_SUPPORTED_FIELD_TYPES.has(field.type)) {
        throw new Error(
            `CMS field "${schemaId}.${field.key}" uses unsupported type "${field.type}".`,
        );
    }

    if (
        field.required !== undefined &&
        typeof field.required !== "boolean"
    ) {
        throw new Error(
            `CMS field "${schemaId}.${field.key}" has invalid required metadata.`,
        );
    }

    if (
        field.maxLength !== undefined &&
        (!Number.isInteger(field.maxLength) ||
            field.maxLength <= 0)
    ) {
        throw new Error(
            `CMS field "${schemaId}.${field.key}" has invalid maxLength metadata.`,
        );
    }

    if (field.group !== undefined) {
        assertNonEmptyString(
            field.group,
            `CMS field "${schemaId}.${field.key}" has invalid group metadata.`,
        );
    }

    if (field.groupLabel !== undefined) {
        assertNonEmptyString(
            field.groupLabel,
            `CMS field "${schemaId}.${field.key}" has invalid groupLabel metadata.`,
        );

        if (field.group === undefined) {
            throw new Error(
                `CMS field "${schemaId}.${field.key}" requires group metadata when groupLabel is provided.`,
            );
        }
    }

    if (
        field.previewAttribute !== undefined &&
        !isSafeCmsPreviewAttribute(
            field.previewAttribute,
        )
    ) {
        throw new Error(
            `CMS field "${schemaId}.${field.key}" has unsafe or unsupported previewAttribute metadata.`,
        );
    }

    assertValidCmsOptions(
        field,
        schemaId,
    );

    assertValidCmsImageOptions(
        field,
        schemaId,
    );
}

export function assertValidCmsSchema(schema) {
    if (!schema || typeof schema !== "object") {
        throw new Error("CMS schema must be an object.");
    }

    assertNonEmptyString(
        schema.id,
        "CMS schema requires a non-empty id.",
    );

    assertNonEmptyString(
        schema.label,
        `CMS schema "${schema.id}" requires a label.`,
    );

    if (schema.itemNoun !== undefined) {
        assertNonEmptyString(
            schema.itemNoun,
            `CMS schema "${schema.id}" has invalid itemNoun metadata.`,
        );
    }

    if (!Array.isArray(schema.fields) || schema.fields.length === 0) {
        throw new Error(
            `CMS schema "${schema.id}" requires at least one field.`,
        );
    }

    const keys = new Set();

    for (const field of schema.fields) {
        assertValidCmsField(field, schema.id);

        if (keys.has(field.key)) {
            throw new Error(
                `CMS schema "${schema.id}" contains duplicate field key "${field.key}".`,
            );
        }

        keys.add(field.key);
    }

    return schema;
}
