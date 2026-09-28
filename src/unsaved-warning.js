/**
 * @param {{
 *   workflow: any,
 *   windowObject?: {
 *     addEventListener: (type: string, listener: Function) => void,
 *     removeEventListener: (type: string, listener: Function) => void
 *   }
 * }} options
 */
export function installCmsUnsavedChangesWarning({
    workflow,
    windowObject = window,
}) {
    function handleBeforeUnload(
        event,
    ) {
        if (
            !workflow.getSnapshot()
                .hasUnsavedChanges
        ) {
            return undefined;
        }

        if (
            typeof event.preventDefault ===
            "function"
        ) {
            event.preventDefault();
        }

        event.returnValue =
            "";

        return "";
    }

    windowObject.addEventListener(
        "beforeunload",
        handleBeforeUnload,
    );

    return {
        destroy() {
            windowObject.removeEventListener(
                "beforeunload",
                handleBeforeUnload,
            );
        },

        handleBeforeUnload,
    };
}
