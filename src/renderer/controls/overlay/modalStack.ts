type ModalStackEntry = {
  id: string;
  handleEscape: () => void;
};

const modalStack: ModalStackEntry[] = [];

export function registerModal(entry: ModalStackEntry): () => void {
  modalStack.push(entry);
  return () => {
    const index = modalStack.findIndex((item) => item.id === entry.id);
    if (index >= 0) {
      modalStack.splice(index, 1);
    }
  };
}

export function getTopModal(): ModalStackEntry | undefined {
  return modalStack[modalStack.length - 1];
}

export function isTopModal(id: string): boolean {
  return getTopModal()?.id === id;
}

export function getModalStackSize(): number {
  return modalStack.length;
}
