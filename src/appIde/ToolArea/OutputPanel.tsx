import { useDispatch, useSelector, useStore } from "@/core/RendererProvider";
import { ToolState } from "@/appIde/abstractions";
import { useAppServices } from "@/appIde/services/AppServicesProvider";
import {
  activateOutputPaneAction,
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@state/actions";
import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dropdown } from "../../controls/common/Dropdown";
import { TabButton, TabButtonSeparator } from "../../controls/common/TabButton";
import { VirtualizedListApi } from "../../controls/common/VirtualizedList";
import { IOutputBuffer, OutputContentLine, OutputSpan } from "./abstractions";
import styles from "./OutputPanel.module.scss";
import { VirtualizedListView } from "@/controls/common/VirtualizedListView";

const OutputPanel = () => {
  const { outputPaneService } = useAppServices();
  const store = useStore();
  const tool = useRef<ToolState>();
  const activePane = useSelector(s => s.ideView?.activeOutputPane);
  const buffer = useRef<IOutputBuffer>();
  const [contents, setContents] = useState<OutputContentLine[]>();
  const api = useRef<VirtualizedListApi>();

  useEffect(() => {
    tool.current = store
      .getState()
      .ideView?.tools.find(t => t.id === "output") as ToolState;
    if (api.current) {
      api.current.refresh();
      api.current.scrollToOffset(tool.current?.stateValue?.[activePane] ?? 0);
    }
    buffer.current = outputPaneService.getOutputPaneBuffer(activePane);
    setContents((buffer?.current?.getContents() ?? []).slice(0));
  }, [activePane]);

  useEffect(() => {
    const handleChanged = () => {
      setContents((buffer?.current?.getContents() ?? []).slice(0));
    };

    if (buffer.current) {
      buffer.current.contentsChanged.on(handleChanged);
    }

    return () => buffer.current?.contentsChanged?.off(handleChanged);
  }, [buffer.current]);

  useLayoutEffect(() => {
      api.current?.scrollToEnd();
  }, [contents]);

  return (
    <div className={styles.component}>
      {activePane && (
        <VirtualizedListView
          items={contents ?? []}
          approxSize={20}
          fixItemHeight={false}
          apiLoaded={vlApi => (api.current = vlApi)}
          itemRenderer={idx => {
            return <OutputLine spans={contents?.[idx]?.spans} />;
          }}
        />
      )}
    </div>
  );
};

type LineProps = {
  spans: OutputSpan[];
};

export const OutputLine = ({ spans }: LineProps) => {
  const segments = (spans ?? []).map((s, idx) => {
    const style: CSSProperties = {
      fontWeight: s.isBold ? 600 : 400,
      fontStyle: s.isItalic ? "italic" : "normal",
      backgroundColor: `var(${
        s.background !== undefined
          ? `--console-ansi-${s.background}`
          : "transparent"
      })`,
      color: `var(${
        s.foreGround !== undefined
          ? `--console-ansi-${s.foreGround}`
          : "--console-default"
      })`,
      textDecoration: `${s.isUnderline ? "underline" : ""} ${
        s.isStrikeThru ? "line-through" : ""
      }`,
      cursor: s.actionable ? "pointer" : undefined
    };
    return (
      <span key={idx} style={style}>
        {s.text}
      </span>
    );
  });
  return <div className={styles.outputLine}>{[...segments]}</div>;
};

export const outputPanelRenderer = () => <OutputPanel />;

export const outputPanelHeaderRenderer = () => {
  const dispatch = useDispatch();
  const { outputPaneService } = useAppServices();
  const panes = outputPaneService.getRegisteredOutputPanes().map(p => ({
    value: p.id,
    label: p.displayName
  }));
  const activePane = useSelector(s => s.ideView?.activeOutputPane);
  return (
    <>
      <Dropdown
        placeholder='Select...'
        options={panes}
        value={activePane}
        onSelectionChanged={option =>
          dispatch(activateOutputPaneAction(option))
        }
      />
      <TabButtonSeparator />
      <TabButton
        iconName='clear-all'
        title='Clear'
        clicked={() => {
          outputPaneService.getOutputPaneBuffer(activePane)?.clear();
          dispatch(incToolCommandSeqNoAction());
        }}
      />
      <TabButtonSeparator />
      <TabButton
        iconName='copy'
        title='Copy to clipboard'
        clicked={async () => {
          navigator.clipboard.writeText(
            outputPaneService.getOutputPaneBuffer(activePane).getBufferText()
          );
          dispatch(
            setIdeStatusMessageAction("Output copied to the clipboard", true)
          );
          dispatch(incToolCommandSeqNoAction());
        }}
      />
    </>
  );
};