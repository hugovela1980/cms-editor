export function joinCmsContentPath(
    sectionPath,
    fieldPath,
) {
    if (
        typeof sectionPath !== "string" ||
        sectionPath.trim() === ""
    ) {
        throw new Error(
            "CMS section path must be a non-empty string."
        );
    }

    if (
        typeof fieldPath !== "string" ||
        fieldPath.trim() === ""
    ) {
        throw new Error(
            "CMS field path must be a non-empty string."
        );
    }

    return `${sectionPath}.${fieldPath}`;
}

export function getValueAtCmsPath(root, path) {
    if (
        typeof path !== "string" ||
        path.trim() === ""
    ) {
        throw new Error(
            "CMS content path must be a non-empty string."
        );
    }

    const segments = path.split(".");
    let current = root;

    for (const segment of segments) {
        if (
            current === null ||
            current === undefined ||
            typeof current !== "object" ||
            !(segment in current)
        ) {
            return undefined;
        }

        current = current[segment];
    }

    return current;
}

export function setValueAtCmsPath(
    root,
    path,
    value,
) {
    if (
        !root ||
        typeof root !== "object"
    ) {
        throw new Error(
            "CMS content root must be an object."
        );
    }

    if (
        typeof path !== "string" ||
        path.trim() === ""
    ) {
        throw new Error(
            "CMS content path must be a non-empty string."
        );
    }

    const segments =
        path.split(".");

    const finalSegment =
        segments.pop();

    let current = root;

    for (const segment of segments) {
        if (
            !current[segment] ||
            typeof current[segment] !== "object"
        ) {
            throw new Error(
                `CMS content path "${path}" cannot be resolved.`
            );
        }

        current =
            current[segment];
    }

    current[finalSegment] =
        value;

    return value;
}