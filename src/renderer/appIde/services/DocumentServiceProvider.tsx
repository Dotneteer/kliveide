import { createContext, useContext, useEffect, useState } from "react";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { useStore } from "@renderer/core/RendererProvider";

const DocumentHubServiceContext = createContext<IDocumentHubService>(undefined);

export function useDocumentHubService (): IDocumentHubService {
  return useContext(DocumentHubServiceContext)!;
}

export function useDocumentHubServiceVersion(hub?: IDocumentHubService): number {
  hub ??= useContext(DocumentHubServiceContext)!;
  const store = useStore();
  const storeState = store.getState();
  const [state, setState] = useState(storeState?.ideView?.documentHubState?.[hub?.hubId]);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const storeState = store.getState();
      if (!storeState) return;

      const newVersion = storeState.ideView?.documentHubState?.[hub?.hubId];
      setState(newVersion);
    });

    return () => unsubscribe();
  }, [store]);

  return state;
}

type Props = {
  value: IDocumentHubService;
  children?: React.ReactNode;
};

export function DocumentHubServiceProvider ({ value, children }: Props) {
  return (
    <DocumentHubServiceContext.Provider value={value}>
      {children}
    </DocumentHubServiceContext.Provider>
  );
}
