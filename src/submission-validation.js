import {
    validateCmsFieldValue,
} from "./field-validation.js";

import {
    CMS_VALIDATION_CODES,
    createCmsValidationError,
    createCmsValidationResult,
} from "./validation-errors.js";

function isPlainObject(
    value,
) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

export function validateCmsValuesForSchema({
    schema,
    values,
}) {
    if (
        !isPlainObject(values)
    ) {
        return createCmsValidationResult({
            values: {},

            errors: [
                createCmsValidationError({
                    code:
                        CMS_VALIDATION_CODES
                            .INVALID_SUBMISSION,

                    schemaId:
                        schema.id,

                    message:
                        "CMS submitted values must be an object.",
                }),
            ],
        });
    }

    const errors = [];

    const validatedValues = {};

    const fieldsByKey =
        new Map(
            schema.fields.map(
                (field) => [
                    field.key,
                    field,
                ],
            ),
        );

    for (
        const fieldKey
        of Object.keys(values)
    ) {
        if (
            !fieldsByKey.has(
                fieldKey,
            )
        ) {
            errors.push(
                createCmsValidationError({
                    code:
                        CMS_VALIDATION_CODES
                            .UNKNOWN_FIELD,

                    schemaId:
                        schema.id,

                    fieldKey,

                    message:
                        `Field "${fieldKey}" is not editable for CMS schema "${schema.id}".`,
                }),
            );
        }
    }

    for (
        const field
        of schema.fields
    ) {
        const hasValue =
            Object.prototype
                .hasOwnProperty
                .call(
                    values,
                    field.key,
                );

        const value =
            hasValue
                ? values[field.key]
                : undefined;

        const result =
            validateCmsFieldValue({
                schemaId:
                    schema.id,

                field,
                value,
            });

        errors.push(
            ...result.errors,
        );

        if (hasValue) {
            validatedValues[
                field.key
            ] = value;
        }
    }

    return createCmsValidationResult({
        values:
            validatedValues,

        errors,
    });
}

export function createCmsSubmissionValidator({
    getSchema,
}) {
    return function validateCmsSubmission({
        schemaId,
        values,
    }) {
        const schema =
            getSchema(
                schemaId,
            );

        if (!schema) {
            return createCmsValidationResult({
                values: {},

                errors: [
                    createCmsValidationError({
                        code:
                            CMS_VALIDATION_CODES
                                .UNKNOWN_SCHEMA,

                        schemaId:
                            typeof schemaId ===
                            "string"
                                ? schemaId
                                : null,

                        message:
                            `Unknown CMS schema "${String(schemaId)}".`,
                    }),
                ],
            });
        }

        return validateCmsValuesForSchema({
            schema,
            values,
        });
    };
}
