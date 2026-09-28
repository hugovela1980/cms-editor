function getVisibleHeight(
    rect,
    viewportHeight,
) {
    const visibleTop =
        Math.max(rect.top, 0);

    const visibleBottom =
        Math.min(
            rect.bottom,
            viewportHeight,
        );

    return Math.max(
        0,
        visibleBottom - visibleTop,
    );
}

function getCenterDistance(
    rect,
    viewportHeight,
) {
    const sectionCenter =
        (rect.top + rect.bottom) / 2;

    const viewportCenter =
        viewportHeight / 2;

    return Math.abs(
        sectionCenter - viewportCenter,
    );
}

export function findActiveCmsSectionEntry(
    sectionEntries,
    viewportHeight = window.innerHeight,
) {
    if (sectionEntries.length === 0) {
        return null;
    }

    const ranked =
        sectionEntries.map((entry) => {
            const rect =
                entry.section
                    .getBoundingClientRect();

            return {
                entry,

                visibleHeight:
                    getVisibleHeight(
                        rect,
                        viewportHeight,
                    ),

                centerDistance:
                    getCenterDistance(
                        rect,
                        viewportHeight,
                    ),
            };
        });

    ranked.sort((left, right) => {
        if (
            right.visibleHeight !==
            left.visibleHeight
        ) {
            return (
                right.visibleHeight -
                left.visibleHeight
            );
        }

        return (
            left.centerDistance -
            right.centerDistance
        );
    });

    return ranked[0]?.entry ?? null;
}