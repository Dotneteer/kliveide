import { HStack } from "@renderer/controls/new/Panels";

type Props = {
  children?: React.ReactNode;
};
export const PanelHeader = ({ children }: Props) => {
  return (
    <HStack paddingHorizontal="4px" paddingVertical="2px"
      verticalContentAlignment="center">
      {children}
    </HStack>
  );
};
