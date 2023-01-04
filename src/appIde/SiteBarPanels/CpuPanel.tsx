import styles from "./CpuPanel.module.scss";

const CpuPanel = () => {
 return <div className={styles.component}>
    <span style={{whiteSpace: "nowrap", wordWrap: "normal"}}>1 CPU Panel, Cpu Panel</span>
    <div style={{whiteSpace: "nowrap"}}>2 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>3 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>4 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>5 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>6 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>7 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>8 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>9 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>10 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>11 CPU Panel, Cpu Panel</div>
    <div style={{whiteSpace: "nowrap"}}>12 CPU Panel, Cpu Panel</div>
 </div>   
}

export const cpuPanelRenderer = () => <CpuPanel />