import { ScrollViewer, ScrollViewerApi } from "@/controls/common/ScrollViewer";
import { TabButton } from "@/controls/common/TabButton";
import { useSelector } from "@/core/RendererProvider";
import { documentPanelRegistry } from "@/registry";
import { useEffect, useRef, useState } from "react";
import { DocumentState } from "../abstractions";
import { useAppServices } from "../services/AppServicesProvider";
import styles from "./DocumentsHeader.module.scss";
import { DocumentTab } from "./DocumentTab";

export const DocumentsHeader = () => {
  const { documentService } = useAppServices();
  const ref = useRef<HTMLDivElement>();
  let openDocs = useSelector(s => s.ideView?.openDocuments);
  if (openDocs) {
    openDocs = openDocs.map(d => {
      const cloned: DocumentState = { ...d };
      const docRenderer = documentPanelRegistry.find(dp => dp.id === d?.type);

      if (docRenderer) {
        cloned.iconName = docRenderer.icon;
        cloned.iconFill = docRenderer.iconFill;
      }
      return cloned;
    });
  }

  const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const [headerVersion, setHeaderVersion] = useState(0);
  const svApi = useRef<ScrollViewerApi>();
  const tabDims = useRef<HTMLDivElement[]>([]);

  // --- Respond to active document tab changes: make sure that the activated tab is displayed
  // --- entirely. If necessary, scroll in the active tab
  useEffect(() => {
    const tabDim = tabDims.current[activeDocIndex];
    if (!tabDim || !ref.current) return;
    const parent = tabDim.parentElement;
    if (!parent) return;

    const tabLeftPos = tabDim.offsetLeft - parent.offsetLeft;
    const tabRightPos = tabLeftPos + tabDim.offsetWidth;
    const scrollPos = svApi.current.getScrollLeft();
    if (tabLeftPos < scrollPos) {
      // --- Left tab edge is hidden, scroll to the left to display the tab
      svApi.current.scrollToHorizontal(tabLeftPos);
    } else if (tabRightPos > scrollPos + parent.offsetWidth) {
      // --- Right tab edge is hidden, scroll to the left to display the tab
      svApi.current.scrollToHorizontal(
        tabLeftPos - parent.offsetWidth + tabDim.offsetWidth
      );
    }
  }, [activeDocIndex, headerVersion]);

  return (openDocs.length ?? 0) > 0 ? (
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
              iconName={d.iconName}
              iconFill={d.iconFill}
              tabDisplayed={el => {
                tabDims.current[idx] = el;
              }}
              tabClicked={() => setHeaderVersion(headerVersion + 1)}
            />
          ))}
        </div>
        <div className={styles.closingTab} />
      </ScrollViewer>
      <div className={styles.commandBar}>
        <TabButton
          iconName='arrow-small-left'
          title={"Move the active\ntab to left"}
          disabled={activeDocIndex === 0}
          useSpace={true}
          clicked={() => documentService.moveActiveToLeft()}
        />
        <TabButton
          iconName='arrow-small-right'
          title={"Move the active\ntab to right"}
          disabled={activeDocIndex === (openDocs?.length ?? 0) - 1}
          useSpace={true}
          clicked={() => {
            documentService.moveActiveToRight();
            setHeaderVersion(headerVersion + 1);
          }}
        />
        <TabButton
          iconName='close'
          useSpace={true}
          clicked={() => {
            documentService.closeAllDocuments();
            setHeaderVersion(headerVersion + 1);
          }}
        />
      </div>
    </div>
  ) : null;
};
