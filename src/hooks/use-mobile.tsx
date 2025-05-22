import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // Initialize state directly from window.innerWidth if available (client-side)
    if (typeof window !== "undefined") {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    // Default for server-side rendering or if window is not yet available
    return false; 
  });

  React.useEffect(() => {
    // Guard against running on the server or in environments without window
    if (typeof window === "undefined") {
      return;
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    // Ensure the state is correct on mount, in case the useState initializer ran before window was fully available
    // or if it was server-rendered with a default.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    mql.addEventListener("change", onChange);
    
    // Cleanup listener on component unmount
    return () => mql.removeEventListener("change", onChange);
  }, []); // Empty dependency array ensures this effect runs once on mount on the client

  return isMobile; // Directly return the boolean state
}
