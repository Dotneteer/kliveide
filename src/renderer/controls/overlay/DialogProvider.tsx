import {
  ComponentType,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Modal } from "../Modal";

export type DialogControls<TResult = unknown> = {
  id: string;
  close: (result: TResult) => void;
  cancel: () => void;
  reject: (error?: unknown) => void;
};

export type DialogComponentProps<TResult = unknown> = {
  controls: DialogControls<TResult>;
};

export type DialogComponent<TResult, TProps> = ComponentType<
  TProps & DialogComponentProps<TResult>
>;

export type DialogOptions = {
  id?: string;
  title?: string;
  width?: number;
  fullWidth?: boolean;
  fullScreen?: boolean;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  dialogRole?: "dialog" | "alertdialog";
  translateY?: number;
};

export type DialogService = {
  open<TResult, TProps>(
    component: DialogComponent<TResult, TProps>,
    props: TProps,
    options?: DialogOptions
  ): Promise<TResult | undefined>;
  closeTop: (result?: unknown) => void;
  cancelTop: () => void;
  closeById: (id: string, result?: unknown) => void;
};

type DialogEntry<TResult = unknown, TProps = Record<string, never>> = {
  id: string;
  component: DialogComponent<TResult, TProps>;
  props: TProps;
  options: DialogOptions;
  resolve: (result: TResult | undefined) => void;
  reject: (error?: unknown) => void;
};

const DialogContext = createContext<DialogService | undefined>(undefined);

type DialogProviderProps = {
  children?: ReactNode;
};

export function DialogProvider({ children }: DialogProviderProps) {
  const [dialogs, setDialogs] = useState<DialogEntry[]>([]);
  const dialogsRef = useRef<DialogEntry[]>([]);
  const nextDialogId = useRef(1);

  useEffect(() => {
    dialogsRef.current = dialogs;
  }, [dialogs]);

  const settleDialog = useCallback(
    (id: string, resolveWith?: unknown, rejectWith?: unknown, shouldReject = false) => {
      const dialog = dialogsRef.current.find((entry) => entry.id === id);
      if (!dialog) return;

      setDialogs((current) => {
        const nextDialogs = current.filter((entry) => entry.id !== id);
        dialogsRef.current = nextDialogs;
        return nextDialogs;
      });
      if (shouldReject) {
        dialog.reject(rejectWith);
      } else {
        dialog.resolve(resolveWith);
      }
    },
    []
  );

  const closeTop = useCallback((result?: unknown) => {
    const dialog = dialogsRef.current[dialogsRef.current.length - 1];
    if (dialog) {
      settleDialog(dialog.id, result);
    }
  }, [settleDialog]);

  const cancelTop = useCallback(() => {
    closeTop(undefined);
  }, [closeTop]);

  const closeById = useCallback((id: string, result?: unknown) => {
    settleDialog(id, result);
  }, [settleDialog]);

  const open = useCallback(
    <TResult, TProps,>(
      component: DialogComponent<TResult, TProps>,
      props: TProps,
      options: DialogOptions = {}
    ): Promise<TResult | undefined> => {
      const id = options.id ?? `dialog-${nextDialogId.current++}`;

      return new Promise<TResult | undefined>((resolve, reject) => {
        setDialogs((current) => {
          const nextDialogs = [
            ...current,
            {
              id,
              component,
              props,
              options: { ...options, id },
              resolve,
              reject
            } as DialogEntry
          ];
          dialogsRef.current = nextDialogs;
          return nextDialogs;
        });
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      for (const dialog of dialogsRef.current) {
        dialog.resolve(undefined);
      }
      dialogsRef.current = [];
    };
  }, []);

  const service = useMemo<DialogService>(
    () => ({
      open,
      closeTop,
      cancelTop,
      closeById
    }),
    [cancelTop, closeById, closeTop, open]
  );

  return (
    <DialogContext.Provider value={service}>
      {children}
      {dialogs.map((dialog) => (
        <ManagedDialog
          key={dialog.id}
          dialog={dialog}
          onClose={(result) => settleDialog(dialog.id, result)}
          onCancel={() => settleDialog(dialog.id, undefined)}
          onReject={(error) => settleDialog(dialog.id, undefined, error, true)}
        />
      ))}
    </DialogContext.Provider>
  );
}

export function useDialogs(): DialogService {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialogs must be used within a DialogProvider.");
  }
  return context;
}

type ManagedDialogProps = {
  dialog: DialogEntry;
  onClose: (result?: unknown) => void;
  onCancel: () => void;
  onReject: (error?: unknown) => void;
};

function ManagedDialog({ dialog, onClose, onCancel, onReject }: ManagedDialogProps) {
  const Component = dialog.component as DialogComponent<unknown, Record<string, unknown>>;
  const controls = useMemo<DialogControls>(
    () => ({
      id: dialog.id,
      close: onClose,
      cancel: onCancel,
      reject: onReject
    }),
    [dialog.id, onCancel, onClose, onReject]
  );

  return (
    <Modal
      isOpen={true}
      title={dialog.options.title}
      width={dialog.options.width}
      fullWidth={dialog.options.fullWidth}
      fullScreen={dialog.options.fullScreen}
      translateY={dialog.options.translateY}
      dialogRole={dialog.options.dialogRole}
      closeOnEscape={dialog.options.closeOnEscape}
      closeOnOutsideClick={dialog.options.closeOnOutsideClick}
      primaryVisible={false}
      secondaryVisible={false}
      cancelVisible={false}
      initialFocus="none"
      onClose={() => onCancel()}
    >
      <Component {...(dialog.props as Record<string, unknown>)} controls={controls} />
    </Modal>
  );
}
