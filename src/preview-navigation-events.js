export function installCmsPreviewNavigationEvents({
    control,
    navigate,
    documentObject = control.ownerDocument,
}) {
    let suppressNextPointerClick = false;

    const onPointerDown = () => {
        suppressNextPointerClick =
            documentObject.activeElement !== control;
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
    control.addEventListener("focus", onFocus);
    control.addEventListener("click", onClick);

    return () => {
        control.removeEventListener("pointerdown", onPointerDown);
        control.removeEventListener("focus", onFocus);
        control.removeEventListener("click", onClick);
    };
}
