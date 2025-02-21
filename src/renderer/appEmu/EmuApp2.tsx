import { HStack, VStack } from "@renderer/controls/new/Stack";

export const EmuApp2 = () => {
  return (
    <>
      <VStack
        backgroundColor="--bgcolor-toolbar"
        paddingHorizontal="--space-4"
        paddingVertical="--space-2"
        gap="--space-2"
      >
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </VStack>
      <HStack
        backgroundColor="--bgcolor-toolbar"
        paddingHorizontal="--space-4"
        paddingVertical="--space-2"
        gap="--space-2"
      >
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </HStack>
    </>
  );
};
