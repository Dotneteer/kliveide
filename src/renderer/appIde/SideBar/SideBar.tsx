import styles from "./SideBar.module.scss";
import { ReactNode, useEffect, useRef } from "react";
import { SideBarHeader } from "./SideBarHeader";
import { SideBarPanel } from "./SideBarPanel";
import { useDispatch, useSelector } from "@/renderer/core/RendererProvider";
import { activityRegistry, sideBarPanelRegistry } from "@/renderer/registry";
import { SideBarPanelState } from "@/common/state/AppState";
import { setSideBarPanelSizeAction, setSideBarPanelsStateAction } from "@/common/state/actions";
import { useResizeObserver } from "@/renderer/core/useResizeObserver";
import { noop } from "@/renderer/utils/stablerefs";

// --- Minimum size of panels in pixels
const MIN_PANEL_SIZE = 60;

type Props = {
    order?: number;
}

/**
 * This function renders the Side Bar component of the IDE
 */
export const SiteBar = ({
    order
}: Props) => {
    const dispatch = useDispatch();

    // --- Follow changes of the current activities and panel state changes
    const activityId = useSelector(s => s.ideView.activity);
    const sideBarPanelsState = useSelector(s => s.ideView.sideBarPanels);

    // --- Obtain the current activity and panel states
    const activity = activityRegistry.find(a => a.id === activityId);
    const panels = sideBarPanelRegistry.filter(reg => reg.hostActivity === activityId)

    // --- Later we need the dimension (height) of the side panel area
    const sideBarRef = useRef<HTMLDivElement>();
    const sideBarHeaderRef = useRef<HTMLDivElement>();

    // --- Follow the side bar dimensions
    const sbHeight = useRef(0);
    const sbHeaderHeight = useRef(0);
    const panelHeadingHeight = useRef(0);

    // --- Some panels may be displayed the fisrt time. We initialize their size and expansion state
    // --- according to the panels' definition. Nonetheless, the state of already initialized items
    // --- do not change.
    useEffect(() => {
        initializeUndisplayedPanels()
    }, 
    [activityId])

    // --- While calculating panel dimensions, we need to know the height of the entiry side bar, the
    // --- height of the side bar header, and also the height of panel headings. We obtain the first two
    // --- dimensions here, while the panel heading height in the `headingSized` event handler
    useEffect(() => {
        sbHeight.current = sideBarRef.current.offsetHeight;
        sbHeaderHeight.current = sideBarHeaderRef.current.offsetHeight;
    }, 
    [sideBarRef.current, sideBarHeaderRef.current]);

    // --- When the side bar panels height changes (window resizing) we update the stored height
    useResizeObserver(sideBarRef, () => {
        sbHeight.current = sideBarRef.current?.offsetHeight ?? 0;
    });

    // --- Follow the current sizing state
    const panelBeingSized = useRef(-1);
    const panelGripPos = useRef(0);
    const panelStartSize = useRef(0);
    const pixelRatio = useRef(0);

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
                suggestedSize={state?.size}
                headingSized={i ? noop : ((h) => { panelHeadingHeight.current = h})}
                startSizing={(pos, size) => startSizingPanel(i, pos, size)}
                sizing={(pos) => sizingPanel(i, pos)}
                endSizing={endSizingPanel} />
        );
    }

    // --- Render the header and the side bar panels
    return (
        <div 
            ref={sideBarRef}
            className={styles.sideBar}
            style={{order}}>
            <SideBarHeader ref={sideBarHeaderRef} activity={activity} />
            {panelElements}
        </div>
    );

    // --- Set the initial state of new panels displayed the first time
    function initializeUndisplayedPanels(): void {
        const initialPanelStates: Record<string, SideBarPanelState> = {};
        let newStates = 0;
        for (const panel of panels) {
            const state = sideBarPanelsState[panel.id];
            if (!state) {
                initialPanelStates[panel.id] = {
                    expanded: panel.expandedOnInit,
                    size: panel.initialSize ?? 1000
                }
                newStates++;
            }
        }
        if (newStates) {
            dispatch(setSideBarPanelsStateAction(initialPanelStates))
        }
    }

    // --- Start sizing the specified panel
    function startSizingPanel(idx: number, pos: number, size: number): void {
        // --- Check if the sizing context is valid
        const sizedPanel = panels[idx];
        if (!sizedPanel) return;
        
        const sizedPanelState = sideBarPanelsState[sizedPanel.id];
        if (!sizedPanelState || !sizedPanelState.expanded) return;

        panelBeingSized.current = idx;
        panelGripPos.current = pos;
        panelStartSize.current = size;
        pixelRatio.current = sizedPanelState.size / size;
    }

    // --- Resizing the specified panel
    function sizingPanel(idx: number, pos: number): void {
        // --- Now, calculate the new panel sizes. First check that we are in a valid resize context.
        const sizedPanel = panels[idx];
        if (!sizedPanel) return;
        
        const sizedPanelState = sideBarPanelsState[sizedPanel.id];
        if (!sizedPanelState || !sizedPanelState.expanded) return;
        
        const nextPanel = panels[idx + 1];
        if (!nextPanel) return;
        
        const nextPanelState = sideBarPanelsState[nextPanel.id];
        if (!nextPanelState || !nextPanelState.expanded) return;
        
        // --- At this point, the sizing context is valid, calculate the new size
        const totalSizeInPixels = (sizedPanelState.size + nextPanelState.size) / pixelRatio.current;
        const delta = pos - panelGripPos.current;
        let newSizeInPixels = Math.max(panelStartSize.current + delta, MIN_PANEL_SIZE);
        let nextSizeInPixels = totalSizeInPixels - newSizeInPixels;

        // --- Is the new size to big?
        if (nextSizeInPixels < MIN_PANEL_SIZE) {
            nextSizeInPixels = MIN_PANEL_SIZE;
            newSizeInPixels = totalSizeInPixels - MIN_PANEL_SIZE;
        }

        // --- Set the sizes of the resized panels
        dispatch(setSideBarPanelSizeAction(
            sizedPanel.id, 
            newSizeInPixels * pixelRatio.current,
            nextPanel.id,
            nextSizeInPixels * pixelRatio.current));
    }

    // --- Complete sizing the panel
    function endSizingPanel(): void {
        panelBeingSized.current = -1;
        panelGripPos.current = 0;
    }
}