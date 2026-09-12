import { ForwardedRef, forwardRef, useRef } from "react";
import { Activity } from "../../abstractions/Activity";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ContextMenu, useContextMenuState } from "@renderer/controls/ContextMenu";
import styles from "./SideBarHeader.module.scss";

type Props = {
  activity?: Activity;
};

export const SideBarHeader = forwardRef(({ activity }: Props, ref: ForwardedRef<HTMLDivElement>) => {
  const [menuState, menuApi] = useContextMenuState();

  /*
   * Popper anchors to a DOM node, and `SmallIconButton` is memoized with no ref of its own, so the
   * anchor is this wrapper rather than the button. Same arrangement as `DocumentsHeader`.
   */
  const menuAnchor = useRef<HTMLSpanElement>(null);

  /*
   * No activity defines commands yet, so today this is always undefined and the strip renders
   * exactly as it did before: no button, no reserved space, no empty menu.
   */
  const Commands = activity?.commands;

  return (
    <div ref={ref} className={styles.sideBarHeader}>
      <span className={styles.text}>{activity?.title}</span>
      {Commands && (
        <div className={styles.actions}>
          <span ref={menuAnchor}>
            <SmallIconButton
              iconName="ellipsis"
              title={`${activity.title} actions`}
              clicked={() => menuApi.showAt(menuAnchor.current)}
            />
          </span>
          <ContextMenu
            state={menuState}
            placement="bottom-end"
            onClickOutside={menuApi.conceal}
          >
            {/*
             * Mounted only while open. Command components read live state, and several of them
             * subscribed to the store permanently would re-render the sidebar header on every
             * machine tick for a menu nobody has opened.
             */}
            {menuState.contextVisible && <Commands close={menuApi.conceal} />}
          </ContextMenu>
        </div>
      )}
    </div>
  );
});
