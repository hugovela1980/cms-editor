export const CMS_VALIDATION_CODES = Object.freeze({
    INVALID_SUBMISSION:
        "invalid_submission",

    UNKNOWN_SCHEMA:
        "unknown_schema",

    UNKNOWN_FIELD:
        "unknown_field",

    INVALID_TYPE:
        "invalid_type",

    REQUIRED:
        "required",

    MAX_LENGTH:
        "max_length",

    INVALID_URL:
        "invalid_url",

    INVALID_OPTION:
        "invalid_option",

    INVALID_EMAIL:
        "invalid_email",

    INVALID_PHONE:
        "invalid_phone",

    INVALID_IMAGE:
        "invalid_image",
});

export function createCmsValidationError({
    code,
    schemaId = null,
    fieldKey = null,
    fieldLabel = null,
    message,
    details = {},
}) {
    return Object.freeze({
        code,
        schemaId,
        fieldKey,
        fieldLabel,
        message,

        details:
            Object.freeze({
                ...details,
            }),
    });
}

export function createCmsValidationResult({
    values = {},
    errors = [],
}) {
    return {
        valid:
            errors.length === 0,

        values,

        errors,
    };
}
