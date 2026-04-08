import { useMemo, useState, type ReactNode } from "react";

type VirtualizedListProps<T> = {
  items: T[];
  rowHeight: number;
  viewportHeight: number;
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
};

export function VirtualizedList<T>({
  items,
  rowHeight,
  viewportHeight,
  overscan = 4,
  renderRow,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * rowHeight;

  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(items.length - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
    return { startIndex: start, endIndex: end };
  }, [items.length, overscan, rowHeight, scrollTop, viewportHeight]);

  const visibleRows = items.slice(startIndex, endIndex + 1);

  return (
    <div
      style={{ height: viewportHeight, overflowY: "auto" }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className="rounded-2xl"
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleRows.map((item, localIndex) => {
          const index = startIndex + localIndex;
          return (
            <div
              key={index}
              style={{
                position: "absolute",
                top: index * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
              }}
            >
              {renderRow(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
