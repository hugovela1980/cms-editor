function findControlErrorElement(
    control,
) {
    return control
        .closest(
            ".cms-field",
        )
        ?.querySelector(
            "[data-cms-field-error]",
        ) ?? null;
}

function findControlSection(
    control,
) {
    return control.closest(
        "[data-cms-drawer-section]",
    );
}

function syncControlSectionErrorState(
    control,
) {
    const section =
        findControlSection(
            control,
        );

    if (!section) {
        return false;
    }

    const hasErrors =
        Boolean(
            section.querySelector(
                '[data-cms-field-key][aria-invalid="true"]',
            ),
        );

    if (hasErrors) {
        section.dataset
            .cmsHasErrors =
            "true";
    } else {
        delete section.dataset
            .cmsHasErrors;
    }

    return hasErrors;
}

function findControlForError(
    drawer,
    error,
) {
    if (!error.fieldKey) {
        return null;
    }

    return Array.from(
        drawer.querySelectorAll(
            "[data-cms-field-key]",
        ),
    ).find(
        (control) =>
            control.dataset
                .cmsFieldKey ===
                error.fieldKey &&
            (
                !error.schemaId ||
                control.dataset
                    .cmsSchemaId ===
                    error.schemaId
            ),
    ) ?? null;
}

export function hasCmsDrawerValidationErrors(
    drawer,
) {
    return Boolean(
        drawer.querySelector(
            '[data-cms-field-key][aria-invalid="true"]',
        ),
    );
}

export function clearCmsControlValidation(
    control,
) {
    control.removeAttribute(
        "aria-invalid",
    );

    control.removeAttribute(
        "aria-errormessage",
    );

    const errorElement =
        findControlErrorElement(
            control,
        );

    if (errorElement) {
        errorElement.textContent =
            "";

        errorElement.hidden =
            true;
    }

    syncControlSectionErrorState(
        control,
    );
}

export function showCmsControlValidationError(
    control,
    error,
) {
    const errorElement =
        findControlErrorElement(
            control,
        );

    if (!errorElement) {
        return;
    }

    errorElement.textContent =
        error.message;

    errorElement.hidden =
        false;

    control.setAttribute(
        "aria-invalid",
        "true",
    );

    control.setAttribute(
        "aria-errormessage",
        errorElement.id,
    );

    syncControlSectionErrorState(
        control,
    );
}

export function clearCmsDrawerValidation(
    drawer,
) {
    for (
        const control
        of drawer.querySelectorAll(
            "[data-cms-field-key]",
        )
    ) {
        clearCmsControlValidation(
            control,
        );
    }
}

export function renderCmsDrawerValidationErrors({
    drawer,
    errors,
    focusFirst = false,
}) {
    clearCmsDrawerValidation(
        drawer,
    );

    let firstInvalidControl =
        null;

    for (const error of errors) {
        const control =
            findControlForError(
                drawer,
                error,
            );

        if (!control) {
            continue;
        }

        if (!firstInvalidControl) {
            firstInvalidControl =
                control;
        }

        if (
            control.getAttribute(
                "aria-invalid",
            ) === "true"
        ) {
            continue;
        }

        showCmsControlValidationError(
            control,
            error,
        );
    }

    if (
        focusFirst &&
        firstInvalidControl &&
        typeof firstInvalidControl
            .focus === "function"
    ) {
        firstInvalidControl.focus();
    }

    return firstInvalidControl;
}
