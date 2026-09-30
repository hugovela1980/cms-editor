function repeatablePathParent(sectionPath) {
    const match = String(sectionPath).match(
        /^(.*?)(?:\.(\d+)|\[(\d+)\])$/,
    );

    return match ? match[1] : null;
}

export function getCmsSectionLabel({
    sectionEntries,
    entryIndex,
}) {
    const entry = sectionEntries[entryIndex];
    const parent = repeatablePathParent(entry.sectionPath);

    if (parent === null) {
        return entry.schema.label;
    }

    const siblings = sectionEntries.filter(
        (candidate) =>
            repeatablePathParent(candidate.sectionPath) === parent &&
            candidate.schema.id === entry.schema.id,
    );
    const position = siblings.indexOf(entry) + 1;
    const noun = String(
        entry.schema.itemNoun ?? "Section",
    ).trim();

    return `${noun} ${position}`;
}
