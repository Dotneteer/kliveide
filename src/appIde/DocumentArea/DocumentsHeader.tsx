import { ScrollViewer, ScrollViewerApi } from "@/controls/common/ScrollViewer";
import { useSelector } from "@/core/RendererProvider";
import { useEffect, useRef } from "react";
import styles from "./DocumentsHeader.module.scss";
import { DocumentTab } from "./DocumentTab";

export const DocumentsHeader = () => {
  const ref = useRef<HTMLDivElement>();
  const openDocs = useSelector(s => s.ideView?.openDocuments);
  const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const svApi = useRef<ScrollViewerApi>();
  const tabDims = useRef<HTMLDivElement[]>([]);

  // --- Respond to active document tab changes: make sure that the activated tab is displayed
  // --- entirely. If necessary, scroll in the active tab
  useEffect(() => {
    const tabDim = tabDims.current[activeDocIndex];
    if (!tabDim || !ref.current) return;

    const parent = tabDim.parentElement;
    const tabLeftPos = tabDim.offsetLeft - parent.offsetLeft;
    const tabRightPos = tabLeftPos + tabDim.offsetWidth;
    const scrollPos = svApi.current.getScrollLeft();
    if (tabLeftPos < scrollPos) {
      // --- Left tab edge is hidden, scroll to the left to display the tab
      svApi.current.scrollToHorizontal(tabLeftPos);
    } else if (tabRightPos > scrollPos + parent.offsetWidth) {
      // --- Right tab edge is hidden, scroll to the left to display the tab
      svApi.current.scrollToHorizontal(tabLeftPos - parent.offsetWidth + tabDim.offsetWidth);
    }
  }, [activeDocIndex])

  return (
    <div ref={ref} className={styles.component}>
      <ScrollViewer
        allowHorizontal={true}
        allowVertical={false}
        scrollBarWidth={4}
        apiLoaded={api => (svApi.current = api)}
      >
        <div className={styles.tabWrapper}>
          {(openDocs ?? []).map((d, idx) => (
            <DocumentTab
              key={d.id}
              index={idx}
              id={d.id}
              name={d.name}
              type={d.type}
              isActive={idx === activeDocIndex}
              isTemporary={d.isTemporary}
              isReadOnly={d.isReadOnly}
              tabDisplayed={(el) => {
                tabDims.current[idx] = el;
              }}
            />
          ))}
        </div>
      </ScrollViewer>
      <div className={styles.closingTab} />
    </div>
  );
};
