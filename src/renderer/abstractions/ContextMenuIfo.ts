export type ContextMenuInfo = {
  separator?: boolean;
  dangerous?: boolean;
  text?: string;
  disabled?: () => boolean;
  clicked?: () => Promise<void>;
};
