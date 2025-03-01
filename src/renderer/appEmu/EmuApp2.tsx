import { FullPanel, HStack, VStack } from "@renderer/controls/new/Panels";
import { useRef } from "react";
import { VirtualizerHandle } from "virtua";
import BankDropdown from "@renderer/controls/new/BankDropdown";

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
      <HStack width="64px" padding="8px">
        <BankDropdown
          banks={224}
          width="100px"
          initialValue={0x0f}
          onChanged={(v) => console.log("Changed", v)}
        />
      </HStack>
    </FullPanel>
  );
};
