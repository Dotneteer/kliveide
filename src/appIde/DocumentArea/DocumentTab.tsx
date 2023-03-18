import styles from "./DocumentTab.module.scss";
import { Icon } from "../../controls/Icon";
import classnames from "@/utils/classnames";
import { useDispatch } from "@/core/RendererProvider";
import {
  activateDocumentAction,
  changeDocumentAction,
  closeDocumentAction,
  incDocumentActivationVersionAction
} from "@state/actions";
import { TabButton } from "../../controls/TabButton";
import { useLayoutEffect, useRef, useState } from "react";
import { DocumentState } from "../../../common/abstractions/DocumentState";
import { TooltipFactory } from "@/controls/Tooltip";

export type Props = DocumentState & {
  index: number;
  iconName?: string;
  iconFill?: string;
  isActive?: boolean;
  tabDisplayed?: (el: HTMLDivElement) => void;
  tabClicked?: () => void;
};

export const DocumentTab = ({
  index,
  id,
  name,
  type,
  isTemporary,
  isReadOnly = false,
  stateValue,
  path,
  language,
  iconName = "file-code",
  iconFill = "--color-doc-icon",
  isActive = false,
  tabDisplayed,
  tabClicked
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
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
        dispatch(incDocumentActivationVersionAction())
      }}
      onDoubleClick={() => {
        if (isTemporary) {
          dispatch(
            changeDocumentAction(
              {
                id,
                name,
                type,
                isReadOnly,
                isTemporary: false,
                iconName,
                iconFill,
                language,
                path,
                stateValue
              } as DocumentState,
              index
            )
          );
        }
        dispatch(incDocumentActivationVersionAction())
      }}
    >
      <Icon iconName={iconName} width={16} height={16} fill={iconFill} />
      <span
        className={classnames(styles.titleText, {
          [styles.activeTitle]: isActive,
          [styles.temporaryTitle]: isTemporary
        })}
      >
        {name}
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
        clicked={() => dispatch(closeDocumentAction(id))}
      />
    </div>
  );
};
