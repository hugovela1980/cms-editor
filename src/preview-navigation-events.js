export function installCmsPreviewNavigationEvents({
    control,
    navigate,
    documentObject = control.ownerDocument,
    focusEvent = "focus",
}) {
    let suppressNextPointerClick = false;

    const onPointerDown = (event) => {
        suppressNextPointerClick = event?.target
            ? documentObject.activeElement !== event.target
            : control.contains
                ? !control.contains(documentObject.activeElement)
                : documentObject.activeElement !== control;
    };
    const onFocus = () => {
        navigate();
    };
    const onClick = () => {
        if (suppressNextPointerClick) {
            suppressNextPointerClick = false;
            return;
        }

        navigate();
    };

    control.addEventListener("pointerdown", onPointerDown);
    control.addEventListener(focusEvent, onFocus);
    control.addEventListener("click", onClick);

    return () => {
        control.removeEventListener("pointerdown", onPointerDown);
        control.removeEventListener(focusEvent, onFocus);
        control.removeEventListener("click", onClick);
    };
}
