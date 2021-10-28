/**
 * Ths interface defines the operations that show an Electron dialog
 */
export interface IDialogService {
  /**
   * Displays a dialog message
   * @param message Dialog message
   * @param title Dialog title
   * @param type Dialog type
   */
  showMessageBox(
    message: string,
    title?: string,
    type?: "info" | "error"
  ): Promise<void>;
}
