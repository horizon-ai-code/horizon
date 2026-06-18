"use client";

import { useEffect } from "react";

/**
 * Global handler that adds a 'is-scrolling' class to any element being scrolled.
 * This class is then used in globals.css to show the scrollbar.
 */
export default function ScrollHandler() {
  useEffect(() => {
    const scrollTimeouts = new Map<HTMLElement | SVGElement, ReturnType<typeof setTimeout>>();

    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.classList) return;

      // Add scrolling class
      target.classList.add("is-scrolling");

      // Clear existing timeout for this element
      const existingTimeout = scrollTimeouts.get(target);
      if (existingTimeout) clearTimeout(existingTimeout);

      // Set new timeout to remove class after 1000ms of inactivity
      const newTimeout = setTimeout(() => {
        target.classList.remove("is-scrolling");
        scrollTimeouts.delete(target);
      }, 1000);

      scrollTimeouts.set(target, newTimeout);
    };

    // Use capture phase to catch all scroll events in the tree
    window.addEventListener("scroll", onScroll, true);
    
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      scrollTimeouts.forEach(timeout => clearTimeout(timeout));
      scrollTimeouts.clear();
    };
  }, []);

  return null;
}
