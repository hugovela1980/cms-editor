const CMS_SAFE_PREVIEW_ATTRIBUTES =
    Object.freeze([
        "alt",
        "aria-label",
        "title",
        "poster",
    ]);

const SAFE_PREVIEW_ATTRIBUTE_SET =
    new Set(CMS_SAFE_PREVIEW_ATTRIBUTES);

const URL_PREVIEW_ATTRIBUTES =
    new Set(["href", "poster", "src"]);

const UNSAFE_URL_SCHEME =
    /^(?:javascript|vbscript):/i;

const UNSAFE_DATA_URL =
    /^data\s*:\s*(?:text\/html|image\/svg\+xml)/i;

export function isSafeCmsPreviewAttribute(attribute) {
    return (
        typeof attribute === "string" &&
        SAFE_PREVIEW_ATTRIBUTE_SET.has(
            attribute.toLowerCase(),
        )
    );
}

export function isSafeCmsPreviewAttributeValue(
    attribute,
    value,
) {
    if (!URL_PREVIEW_ATTRIBUTES.has(attribute)) {
        return true;
    }

    const normalizedValue = String(value ?? "")
        .trim()
        .replace(/[\u0000-\u0020]+/g, "");

    return !(
        UNSAFE_URL_SCHEME.test(normalizedValue) ||
        UNSAFE_DATA_URL.test(normalizedValue)
    );
}
