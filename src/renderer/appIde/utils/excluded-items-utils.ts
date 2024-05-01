import { ResponseMessage } from "@common/messaging/messages-core";
import { IdeProject } from "@common/state/AppState";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { getIsWindows } from "@renderer/os-utils";

export type ExcludedItemInfo = {
  id: string;
  value: string;
};

export async function excludedItemsFromGlobalSettingsAsync(
  messenger: MessengerBase
): Promise<ExcludedItemInfo[]> {
  const response = await messenger.sendMessage({
    type: "MainGloballyExcludedProjectItems"
  });
  return excludedItemsFromGlobalSettings(response);
}

export function excludedItemsFromGlobalSettings(response: ResponseMessage): ExcludedItemInfo[] {
  return postprocessResult(
    response.type == "TextContents"
      ? response.contents
          .split(getIsWindows() ? ";" : ":")
          .filter((id) => id?.length > 0)
          .map((id) => ({ id, value: cvtPath(id) }))
      : []
  );
}

export function excludedItemsFromProject(project?: IdeProject): ExcludedItemInfo[] {
  if (project?.isKliveProject !== true) return [];
  return postprocessResult(
    project.excludedItems?.map((id) => {
      const value = cvtPath(id);
      return {
        id,
        value,
      };
    }) ?? []
  );
}

const cvtPath = (id: string) => id.replace("/", getIsWindows() ? "\\" : "/");
const postprocessResult = (result: ExcludedItemInfo[]): ExcludedItemInfo[] => {
  result.sort((a, b) => a.value.localeCompare(b.value));
  return result;
};
