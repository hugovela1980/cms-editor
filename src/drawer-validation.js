import {
    joinCmsContentPath,
} from "./content-path.js";

import {
    validateCmsFieldValue,
} from "./field-validation.js";

import {
    validateCmsValuesForSchema,
} from "./submission-validation.js";

function findSectionEntry(
    sectionEntries,
    sectionPath,
) {
    return sectionEntries.find(
        (entry) =>
            entry.sectionPath ===
            sectionPath,
    ) ?? null;
}

function findField(
    entry,
    fieldKey,
) {
    return entry.schema.fields.find(
        (field) =>
            field.key ===
            fieldKey,
    ) ?? null;
}

function getControlValue(
    control,
) {
    return control.value ?? "";
}

export function validateCmsDrawerSubmission({
    drawer,
    sectionEntries,
}) {
    const controls =
        Array.from(
            drawer.querySelectorAll(
                "[data-cms-field-key]",
            ),
        );

    const errors = [];
    const entries = [];

    for (
        const sectionEntry
        of sectionEntries
    ) {
        const values = {};

        for (
            const control
            of controls
        ) {
            if (
                control.dataset
                    .cmsSectionPath !==
                sectionEntry.sectionPath
            ) {
                continue;
            }

            const fieldKey =
                control.dataset
                    .cmsFieldKey;

            if (
                typeof fieldKey !==
                    "string" ||
                fieldKey === ""
            ) {
                continue;
            }

            values[fieldKey] =
                getControlValue(
                    control,
                );
        }

        const result =
            validateCmsValuesForSchema({
                schema:
                    sectionEntry.schema,

                values,
            });

        errors.push(
            ...result.errors,
        );

        for (
            const [
                fieldKey,
                value,
            ]
            of Object.entries(
                result.values,
            )
        ) {
            entries.push({
                path:
                    joinCmsContentPath(
                        sectionEntry
                            .sectionPath,

                        fieldKey,
                    ),

                value,
            });
        }
    }

    return {
        valid:
            errors.length === 0,

        entries:
            errors.length === 0
                ? entries
                : [],

        errors,
    };
}

export function validateCmsDrawerControl({
    control,
    sectionEntries,
}) {
    const sectionEntry =
        findSectionEntry(
            sectionEntries,
            control.dataset
                .cmsSectionPath,
        );

    if (!sectionEntry) {
        return {
            valid: true,
            errors: [],
        };
    }

    const field =
        findField(
            sectionEntry,
            control.dataset
                .cmsFieldKey,
        );

    if (!field) {
        const result =
            validateCmsValuesForSchema({
                schema:
                    sectionEntry.schema,

                values: {
                    [
                        control.dataset
                            .cmsFieldKey ??
                        ""
                    ]:
                        getControlValue(
                            control,
                        ),
                },
            });

        return {
            valid:
                result.valid,

            errors:
                result.errors.filter(
                    (error) =>
                        error.fieldKey ===
                        control.dataset
                            .cmsFieldKey,
                ),
        };
    }

    return validateCmsFieldValue({
        schemaId:
            sectionEntry
                .schema
                .id,

        field,

        value:
            getControlValue(
                control,
            ),
    });
}
