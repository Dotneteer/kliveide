import { IdeProject } from "@common/state/AppState";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { getIsWindows } from "@renderer/os-utils";
import { createMainAltApi } from "@common/messaging/MainApiAlt";

export type ExcludedItemInfo = {
  id: string;
  value: string;
};

export async function getExcludedProjectItemsFromGlobalSettings(
  messenger: MessengerBase
): Promise<ExcludedItemInfo[]> {
  const content = await createMainAltApi(messenger).getGloballyExcludedProjectItems();
  return excludedItemsFromGlobalSettings(content);
}

function excludedItemsFromGlobalSettings(content: string): ExcludedItemInfo[] {
  return postprocessResult(
    content
      .split(getIsWindows() ? ";" : ":")
      .filter((id) => id?.length > 0)
      .map((id) => ({ id, value: cvtPath(id) }))
  );
}

export function excludedItemsFromProject(project?: IdeProject): ExcludedItemInfo[] {
  if (project?.isKliveProject !== true) return [];
  return postprocessResult(
    project.excludedItems?.map((id) => {
      const value = cvtPath(id);
      return {
        id,
        value
      };
    }) ?? []
  );
}

const cvtPath = (id: string) => id.replace("/", getIsWindows() ? "\\" : "/");
const postprocessResult = (result: ExcludedItemInfo[]): ExcludedItemInfo[] => {
  result.sort((a, b) => a.value.localeCompare(b.value));
  return result;
};
