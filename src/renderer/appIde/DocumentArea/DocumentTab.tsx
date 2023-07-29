import styles from "./DocumentTab.module.scss";
import { Icon } from "../../controls/Icon";
import classnames from "@/renderer/utils/classnames";
import { useDispatch } from "@/renderer/core/RendererProvider";
import {
  activateDocumentAction,
  closeDocumentAction,
  incDocumentActivationVersionAction
} from "@/common/state/actions";
import { TabButton } from "../../controls/TabButton";
import { useLayoutEffect, useRef, useState } from "react";
import { TooltipFactory } from "@/renderer/controls/Tooltip";
import { useAppServices } from "../services/AppServicesProvider";
import { DocumentInfo } from "@abstractions/DocumentInfo";

export type Props = DocumentInfo & {
  index: number;
  iconName?: string;
  iconFill?: string;
  isActive?: boolean;
  tabDisplayed?: (el: HTMLDivElement) => void;
  tabClicked?: () => void;
  tabDoubleClicked?: () => void;
};

export const DocumentTab = ({
  id,
  name,
  isTemporary,
  isReadOnly = false,
  path,
  iconName = "file-code",
  iconFill = "--color-doc-icon",
  isActive = false,
  tabDisplayed,
  tabClicked,
  tabDoubleClicked
}: Props) => {
  const {documentService } = useAppServices();
  const ref = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const readOnlyRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const [pointed, setPointed] = useState(false);

  useLayoutEffect(() => {
    if (ref.current) {
      tabDisplayed?.(ref.current);
    }
  }, [ref.current, ref.current?.offsetLeft]);
  return (
    <div
      ref={ref}
      className={classnames(styles.documentTab, { [styles.active]: isActive })}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onClick={() => {
        tabClicked?.();
        dispatch(activateDocumentAction(id));
        dispatch(incDocumentActivationVersionAction());
      }}
      onDoubleClick={() => {
        tabDoubleClicked?.();
      }}
    >
      <Icon iconName={iconName} width={16} height={16} fill={iconFill} />
      <span
        ref={nameRef}
        className={classnames(styles.titleText, {
          [styles.activeTitle]: isActive,
          [styles.temporaryTitle]: isTemporary
        })}
      >
        <bdi>{name}</bdi>
        <TooltipFactory
          refElement={nameRef.current}
          placement='right'
          offsetX={-28}
          offsetY={28}
        >
          {path}
        </TooltipFactory>
      </span>
      {isReadOnly && (
        <div className={styles.readOnlyIcon} ref={readOnlyRef}>
          <Icon
            iconName='shield'
            width={16}
            height={16}
            fill={
              isActive
                ? "--color-readonly-icon-active"
                : "--color-readonly-icon-inactive"
            }
          />
          <TooltipFactory
            refElement={readOnlyRef.current}
            placement='right'
            offsetX={-16}
            offsetY={28}
          >
            This file is read-only
          </TooltipFactory>
        </div>
      )}
      <TabButton
        iconName='close'
        hide={!pointed && !isActive}
        fill={
          isActive
            ? "--color-tabbutton-fill-active"
            : "--color-tabbutton-fill-inactive"
        }
        clicked={() => {
          dispatch(closeDocumentAction(id));
          documentService.closeDocument(id);
        }}
      />
    </div>
  );
};
