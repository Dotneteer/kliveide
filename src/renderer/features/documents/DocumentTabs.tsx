import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { CloseMode, DocumentTab } from "./DocumentTab";
import styles from "./DocumentsHeader.module.scss";

type DocumentTabsProps = {
  activeDocIndex: number;
  awaiting: boolean;
  dirtyStates?: boolean[];
  isProjectDebugging: boolean;
  openDocs: ProjectDocumentState[];
  onTabClicked: (id: string) => void;
  onTabCloseClicked: (mode: CloseMode, id: string) => void;
  onTabDisplayed: (idx: number, el: HTMLDivElement) => void;
  onTabDoubleClicked: (document: ProjectDocumentState) => void;
  tabsCount: number;
};

export function DocumentTabs({
  activeDocIndex,
  awaiting,
  dirtyStates,
  isProjectDebugging,
  openDocs,
  onTabClicked,
  onTabCloseClicked,
  onTabDisplayed,
  onTabDoubleClicked,
  tabsCount
}: DocumentTabsProps) {
  return (
    <div className={styles.tabWrapper}>
      {openDocs.map((document, idx) => {
        const docName = openDocs.find(
          (doc) => doc.name === document.name && doc.id !== document.id && doc.path
        )
          ? document.path
          : document.name;
        return (
          <DocumentTab
            key={document.id}
            name={docName}
            path={document.path}
            isActive={idx === activeDocIndex}
            isTemporary={document.isTemporary}
            isReadOnly={document.isReadOnly}
            isLocked={isProjectDebugging && document.isLocked}
            awaiting={awaiting}
            hasChanges={dirtyStates?.[idx]}
            tabsCount={tabsCount}
            iconName={document.iconName}
            iconFill={document.iconFill}
            tabDisplayed={(el) => onTabDisplayed(idx, el)}
            tabClicked={() => onTabClicked(document.id)}
            tabDoubleClicked={() => onTabDoubleClicked(document)}
            tabCloseClicked={(mode: CloseMode) => onTabCloseClicked(mode, document.id)}
          />
        );
      })}
    </div>
  );
}
