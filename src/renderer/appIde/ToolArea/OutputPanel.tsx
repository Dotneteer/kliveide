import { useDispatch, useSelector, useStore } from "@renderer/core/RendererProvider";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import {
  activateOutputPaneAction,
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@state/actions";
import {
  CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { Dropdown } from "@controls/Dropdown";
import { TabButton, TabButtonSpace } from "@controls/TabButton";
import { VirtualizedListApi } from "@controls/VirtualizedList";
import { IOutputBuffer, OutputContentLine } from "./abstractions";
import styles from "./OutputPanel.module.scss";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import { ToolState } from "@renderer/abstractions/ToolState";
import { delay } from "@renderer/utils/timing";

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
    (async () => {
      await delay(20);
      api.current?.scrollToEnd();
    })();
  }, [contents]);

  return (
    <div className={styles.outputPanel}>
      {activePane && (
        <VirtualizedListView
          items={contents ?? []}
          approxSize={20}
          fixItemHeight={false}
          vlApiLoaded={vlApi => (api.current = vlApi)}
          itemRenderer={idx => {
            return <OutputLine spans={contents?.[idx]?.spans} />;
          }}
        />
      )}
    </div>
  );
};

export const OutputLine = ({ spans }: OutputContentLine) => {
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
      <span
        key={idx}
        style={style}
        onClick={() => {
          if (s.actionable) {
            if (typeof s.data === "function") {
              s.data();
            }
          }
        }}
      >
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
      <TabButtonSpace />
      <TabButton
        iconName='clear-all'
        title='Clear'
        clicked={() => {
          outputPaneService.getOutputPaneBuffer(activePane)?.clear();
          dispatch(incToolCommandSeqNoAction());
        }}
      />
      <TabButtonSpace />
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
