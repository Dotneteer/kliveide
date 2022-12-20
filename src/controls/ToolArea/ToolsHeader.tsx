import { useSelector } from "@/emu/StoreProvider";
import styles from "./ToolsHeader.module.scss";
import { ToolTab } from "./ToolTab";

export const ToolsHeader = () => {
    const tools = useSelector(s => s.ideView?.tools);
    const activeTool = useSelector(s => s.ideView?.activeTool)
    return <div className={styles.component}>
        {(tools ?? []).filter(t => t.visible ?? true).map(d => 
            <ToolTab 
              id={d.id}
              key={d.id}
              name={d.name}
              isActive={d.id === activeTool}
            />
        )}
        <div className={styles.closingTab} />
    </div>
}