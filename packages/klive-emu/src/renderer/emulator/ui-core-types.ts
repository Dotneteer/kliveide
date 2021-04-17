/**
 * Event arguments when pressing a key on the virtual keyboard
 */
export interface ButtonClickArgs {
  code: number;
  keyCategory: string;
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  shiftKey: boolean;
}
