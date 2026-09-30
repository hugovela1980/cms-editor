const PREVIEW_TARGET_SELECTOR =
    "[data-cms-preview-field]";

function readPreviewFieldTokens(element) {
    return (
        element.dataset.cmsPreviewField ?? ""
    )
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean);
}

export function findCmsPreviewTarget(
    section,
    fieldKey,
) {
    const candidates = Array.from(
        section.querySelectorAll(
            PREVIEW_TARGET_SELECTOR,
        ),
    );

    return (
        candidates.find((element) =>
            readPreviewFieldTokens(
                element,
            ).includes(fieldKey),
        ) ?? null
    );
}

export function clearCmsHighlights(
    documentObject = document,
) {
    for (const element of documentObject.querySelectorAll(
        "[data-cms-highlight]",
    )) {
        element.removeAttribute(
            "data-cms-highlight",
        );
    }
}

export function highlightCmsSection(
    section,
    documentObject = document,
) {
    clearCmsHighlights(documentObject);

    section.setAttribute(
        "data-cms-highlight",
        "section",
    );
}

export function highlightCmsField(
    section,
    fieldKey,
    documentObject = document,
) {
    clearCmsHighlights(documentObject);

    const target = findCmsPreviewTarget(
        section,
        fieldKey,
    );

    if (!target) {
        return null;
    }

    target.setAttribute(
        "data-cms-highlight",
        "field",
    );

    return target;
}
