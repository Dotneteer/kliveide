import styles from "./SideBar.module.scss";
import { ReactNode, useRef } from "react";
import { SideBarHeader } from "./SideBarHeader";
import { SideBarPanel } from "./SideBarPanel";
import { useSelector } from "@/emu/StoreProvider";
import { activityRegistry, sideBarPanelRegistry } from "@/registry";

type Props = {
    order?: number;
}

export const SiteBar = ({
    order
}: Props) => {
    // --- Follow changes of the current activities and panel state changes
    const activityId = useSelector(s => s.ideView.activity);
    const sideBarPanelsState = useSelector(s => s.ideView.sideBarPanels);

    // --- Obtain the current activity and panel states
    const activity = activityRegistry.find(a => a.id === activityId);
    const panels = sideBarPanelRegistry.filter(reg => reg.hostActivity === activityId)

    // --- Later we need the dimension (height) of the side panel area
    const sideBarRef = useRef<HTMLDivElement>();
    const sideBarHeaderRef = useRef<HTMLDivElement>();

    // --- Follow the current sizing state
    const panelBeingSized = useRef(-1);
    const panelGripPos = useRef(0);

    // --- Store the suggested panel sizes
    const panelSizes = calculatePanelSizes();

    // --- Create the panels of the side bar
    const panelElements: ReactNode[] = [];
    for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const state = sideBarPanelsState[panel.id];

        // --- Is the current panel sizable?
        const thisExpanded = state?.expanded;
        const nextExpanded = i < panels.length - 1
            ? sideBarPanelsState[panels[i+1].id]?.expanded
            : false;
        const sizeable = thisExpanded && nextExpanded;

        // --- Add the current panel
        panelElements.push(
            <SideBarPanel 
                key={panel.id} 
                index={i}
                sideBar={panel} 
                sizeable={sizeable}
                expanded={thisExpanded ?? false} 
                suggestedSize={panelSizes[i]}
                startSizing={(pos) => startSizingPanel(i, pos)}
                sizing={(pos) => sizingPanel(i, pos)}
                endSizing={endSizingPanel} />
        );
    }

    // --- Render the header and the side bar panels
    return (
        <div 
            ref={sideBarRef}
            className={styles.component}
            style={{order}}>
            <SideBarHeader ref={sideBarHeaderRef} activity={activity} />
            {panelElements}
        </div>
    );

    // --- Start sizing the specified panel
    function startSizingPanel(idx: number, pos: number): void {
        panelBeingSized.current = idx;
        panelGripPos.current = pos;
        console.log(`Start sizing ${idx} at ${pos}`);
    }

    // --- Resizing the specified panel
    function sizingPanel(idx: number, pos: number): void {
        const delta = pos - panelGripPos.current;
        console.log(`New delta of ${idx} at ${delta}`);
    }

    // --- Complete sizing the panel
    function endSizingPanel(): void {
        panelBeingSized.current = -1;
        panelGripPos.current = 0;
    }

    function calculatePanelSizes(): number[] {
        const sizes: number[] = [];
        // --- Does any expanded panel has a size within the state?
        const hasExplicitSize = panels.some((p, idx) => 
            sideBarPanelsState[p.id]?.expanded && sideBarPanelsState[p.id].size !== undefined);
        if (!hasExplicitSize) return sizes;

        // --- Otherwise, we have to recalculate the panel sizes
        return sizes;
    }
}