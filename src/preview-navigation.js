export function scrollCmsPreviewTargetIntoView(
    target,
    {
        windowObject = target?.ownerDocument?.defaultView,
        comfortableMargin = 0.15,
    } = {},
) {
    if (
        !target?.isConnected ||
        typeof target.getBoundingClientRect !== "function" ||
        typeof target.scrollIntoView !== "function"
    ) {
        return false;
    }

    if (
        typeof target.getClientRects === "function" &&
        target.getClientRects().length === 0
    ) {
        return false;
    }

    const rect = target.getBoundingClientRect();
    const viewportWidth = Number(windowObject?.innerWidth) || 0;
    const viewportHeight = Number(windowObject?.innerHeight) || 0;

    if (
        !viewportWidth ||
        !viewportHeight ||
        rect.width <= 0 ||
        rect.height <= 0
    ) {
        return false;
    }

    const verticalMargin = Math.min(
        viewportHeight * comfortableMargin,
        120,
    );
    const horizontalMargin = Math.min(
        viewportWidth * comfortableMargin,
        120,
    );
    const comfortablyVisible =
        rect.top >= verticalMargin &&
        rect.bottom <= viewportHeight - verticalMargin &&
        rect.left >= horizontalMargin &&
        rect.right <= viewportWidth - horizontalMargin;

    if (comfortablyVisible) {
        return false;
    }

    const reducedMotion = Boolean(
        windowObject?.matchMedia?.(
            "(prefers-reduced-motion: reduce)",
        ).matches,
    );

    target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
    });

    return true;
}
