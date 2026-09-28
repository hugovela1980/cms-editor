import {
    CMS_FIELD_TYPES,
} from "./field-types.js";

import {
    CMS_VALIDATION_CODES,
    createCmsValidationError,
    createCmsValidationResult,
} from "./validation-errors.js";

const EMAIL_PATTERN =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_ALLOWED_PATTERN =
    /^[0-9+().\-\s]*(?:(?:x|ext\.?)\s*\d+)?$/i;

const PHONE_EXTENSION_PATTERN =
    /\s*(?:x|ext\.?)\s*(\d+)$/i;

function createFieldError({
    code,
    schemaId,
    field,
    message,
    details,
}) {
    return createCmsValidationError({
        code,
        schemaId,
        fieldKey:
            field.key,

        fieldLabel:
            field.label,

        message,
        details,
    });
}

function isEmptyString(
    value,
) {
    return (
        typeof value === "string" &&
        value.trim() === ""
    );
}

export function isValidCmsUrl(
    value,
) {
    const candidate =
        value.trim();

    if (
        candidate === "" ||
        /\s/.test(candidate)
    ) {
        return false;
    }

    if (
        candidate.startsWith("#") ||
        candidate.startsWith("?")
    ) {
        return true;
    }

    if (
        candidate.startsWith("/")
    ) {
        return !candidate.startsWith(
            "//",
        );
    }

    if (
        candidate.startsWith("./") ||
        candidate.startsWith("../")
    ) {
        return true;
    }

    try {
        const parsed =
            new URL(candidate);

        return (
            parsed.protocol ===
                "http:" ||
            parsed.protocol ===
                "https:"
        );
    } catch {
        return false;
    }
}

export function isValidCmsEmail(
    value,
) {
    const candidate =
        value.trim();

    return EMAIL_PATTERN.test(
        candidate,
    );
}

export function isValidCmsPhone(
    value,
) {
    const candidate =
        value.trim();

    if (
        candidate === "" ||
        !PHONE_ALLOWED_PATTERN.test(
            candidate,
        )
    ) {
        return false;
    }

    const extensionMatch =
        candidate.match(
            PHONE_EXTENSION_PATTERN,
        );

    const extension =
        extensionMatch?.[1] ??
        "";

    if (
        extension.length > 6
    ) {
        return false;
    }

    const mainNumber =
        extensionMatch
            ? candidate.slice(
                0,
                extensionMatch.index,
            )
            : candidate;

    if (
        mainNumber
            .slice(1)
            .includes("+")
    ) {
        return false;
    }

    const mainDigits =
        mainNumber.replace(
            /\D/g,
            "",
        );

    return (
        mainDigits.length >= 7 &&
        mainDigits.length <= 15
    );
}

export function validateCmsFieldValue({
    schemaId,
    field,
    value,
}) {
    const errors = [];

    if (
        value === undefined
    ) {
        if (
            field.required ===
            true
        ) {
            errors.push(
                createFieldError({
                    code:
                        CMS_VALIDATION_CODES
                            .REQUIRED,

                    schemaId,
                    field,

                    message:
                        `${field.label} is required.`,
                }),
            );
        }

        return createCmsValidationResult({
            values: {
                value,
            },
            errors,
        });
    }

    if (
        typeof value !== "string"
    ) {
        errors.push(
            createFieldError({
                code:
                    CMS_VALIDATION_CODES
                        .INVALID_TYPE,

                schemaId,
                field,

                message:
                    `${field.label} must be text.`,
            }),
        );

        return createCmsValidationResult({
            values: {
                value,
            },
            errors,
        });
    }

    if (
        isEmptyString(value)
    ) {
        if (
            field.required ===
            true
        ) {
            errors.push(
                createFieldError({
                    code:
                        CMS_VALIDATION_CODES
                            .REQUIRED,

                    schemaId,
                    field,

                    message:
                        `${field.label} is required.`,
                }),
            );
        }

        return createCmsValidationResult({
            values: {
                value,
            },
            errors,
        });
    }

    if (
        Number.isInteger(
            field.maxLength,
        ) &&
        value.length >
            field.maxLength
    ) {
        errors.push(
            createFieldError({
                code:
                    CMS_VALIDATION_CODES
                        .MAX_LENGTH,

                schemaId,
                field,

                message:
                    `${field.label} must be ${field.maxLength} characters or fewer.`,

                details: {
                    maxLength:
                        field.maxLength,

                    actualLength:
                        value.length,
                },
            }),
        );
    }

    switch (field.type) {
        case CMS_FIELD_TYPES.URL:
            if (
                !isValidCmsUrl(
                    value,
                )
            ) {
                errors.push(
                    createFieldError({
                        code:
                            CMS_VALIDATION_CODES
                                .INVALID_URL,

                        schemaId,
                        field,

                        message:
                            `${field.label} must be a valid web URL, site-relative path, query, or fragment.`,
                    }),
                );
            }
            break;

        case CMS_FIELD_TYPES.PAGE:
            if (
                !field.options.some(
                    (option) =>
                        option.value ===
                        value,
                )
            ) {
                errors.push(
                    createFieldError({
                        code:
                            CMS_VALIDATION_CODES
                                .INVALID_OPTION,

                        schemaId,
                        field,

                        message:
                            `${field.label} must be one of the available site pages.`,

                        details: {
                            allowedValues:
                                field.options.map(
                                    (option) =>
                                        option.value,
                                ),
                        },
                    }),
                );
            }
            break;

        case CMS_FIELD_TYPES.EMAIL:
            if (
                !isValidCmsEmail(
                    value,
                )
            ) {
                errors.push(
                    createFieldError({
                        code:
                            CMS_VALIDATION_CODES
                                .INVALID_EMAIL,

                        schemaId,
                        field,

                        message:
                            `${field.label} must be a valid email address.`,
                    }),
                );
            }
            break;

        case CMS_FIELD_TYPES.IMAGE:
            if (
                !isValidCmsUrl(
                    value,
                )
            ) {
                errors.push(
                    createFieldError({
                        code:
                            CMS_VALIDATION_CODES
                                .INVALID_IMAGE,

                        schemaId,
                        field,

                        message:
                            `${field.label} must reference a valid image path.`,
                    }),
                );
            }
            break;

        case CMS_FIELD_TYPES.PHONE:
            if (
                !isValidCmsPhone(
                    value,
                )
            ) {
                errors.push(
                    createFieldError({
                        code:
                            CMS_VALIDATION_CODES
                                .INVALID_PHONE,

                        schemaId,
                        field,

                        message:
                            `${field.label} must be a valid phone number.`,
                    }),
                );
            }
            break;

        default:
            break;
    }

    return createCmsValidationResult({
        values: {
            value,
        },
        errors,
    });
}
