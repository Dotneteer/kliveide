import { FullPanel, HStack, VStack } from "@renderer/controls/new/Panels";
import ScrollViewer from "@renderer/controls/new/ScrollViewer";

export const EmuApp2 = () => {
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
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </HStack>
      <ScrollViewer>
        <VStack
          id="myStack"
          padding="2px"
          height="2000px"
          width="2000px"
          verticalContentAlignment="center"
          horizontalContentAlignment="end"
        >
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </VStack>
      </ScrollViewer>
    </FullPanel>
  );
};
