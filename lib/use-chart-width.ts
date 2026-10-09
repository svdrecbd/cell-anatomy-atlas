"use client";

import { useEffect, useRef, useState } from "react";

export function useChartWidth() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(840);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const updateWidth = () => setChartWidth(Math.max(840, Math.floor(container.getBoundingClientRect().width)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return { chartContainerRef, chartWidth };
}
