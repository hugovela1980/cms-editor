export function acceptsCmsFile(file, accept) {
    const name = String(file?.name ?? "").toLowerCase();
    const type = String(file?.type ?? "").toLowerCase();
    return accept.some((entry) => {
        const pattern = entry.trim().toLowerCase();
        if (pattern.startsWith(".")) return name.endsWith(pattern);
        if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
        return type === pattern;
    });
}

export function normalizeCmsFileMetadata(result) {
    if (!result || typeof result !== "object") return null;
    return {
        name: typeof result.name === "string" && result.name.trim() ? result.name : null,
        previewUrl: typeof result.previewUrl === "string" && result.previewUrl.trim()
            ? result.previewUrl : null,
    };
}
