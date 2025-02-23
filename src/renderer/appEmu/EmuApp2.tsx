import { FullPanel, HStack, VStack } from "@renderer/controls/new/Panels";
import ScrollViewer from "@renderer/controls/new/ScrollViewer";
import { VirtualizedList } from "@renderer/controls/new/VirtualizedList";
import { useRef } from "react";
import { VirtualizerHandle } from "virtua";

export const EmuApp2 = () => {
  const vlApi = useRef<VirtualizerHandle>(null);

  return (
    <FullPanel backgroundColor="--bgcolor-toolbar">
      <VStack
        backgroundColor="--bgcolor-toolbar"
        paddingHorizontal="--space-4"
        paddingVertical="--space-2"
        gap="--space-2"
        height="200px"
        horizontalContentAlignment="end"
        verticalContentAlignment="end"
      >
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </VStack>
      <HStack
        backgroundColor="blue"
        paddingHorizontal="--space-4"
        paddingVertical="--space-2"
        gap="--space-2"
        height="40px"
        verticalContentAlignment="center"
        horizontalContentAlignment="center"
      >
        <button onClick={() => vlApi.current?.scrollToIndex(0)}>Scroll to 0</button>
        <button onClick={() => vlApi.current?.scrollToIndex(100)}>Scroll to 100</button>
        <button onClick={() => vlApi.current?.scrollToIndex(5_000_000)}>Scroll to end</button>
      </HStack>
      <VirtualizedList
        items={Array.from({
          length: 1000
        }).map((_, i) => i)}
        apiLoaded={(api) => (vlApi.current = api)}
        overscan={25}
        renderItem={i => <div key={i} style={{ height: "20px" }}>Item {i}</div>}
      />
    </FullPanel>
  );
};
