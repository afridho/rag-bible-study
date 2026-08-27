import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    // Initialize lazily from the current window size so we don't need to call
    // setState synchronously inside the effect (which the linter flags).
    const [isMobile, setIsMobile] = React.useState<boolean>(
        () =>
            typeof window !== "undefined" &&
            window.innerWidth < MOBILE_BREAKPOINT,
    );

    React.useEffect(() => {
        const mql = window.matchMedia(
            `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
        );
        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, []);

    return isMobile;
}
