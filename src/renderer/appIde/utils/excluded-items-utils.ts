import * as path from "path";
import * as fs from "fs";

import { ResponseMessage } from "@common/messaging/messages-core";
import { IdeProject } from "@common/state/AppState";
import { MessengerBase } from "@common/messaging/MessengerBase";

export type ExcludedItemInfo = {
  id: string;
  value: string;
  missing?: boolean;
};

export async function excludedItemsFromGlobalSettingsAsync(messenger: MessengerBase): Promise<ExcludedItemInfo[]> {
  const response = await messenger.sendMessage({
    type: "MainGloballyExcludedProjectItems",
  });
  return excludedItemsFromGlobalSettings(response);
}

export function excludedItemsFromGlobalSettings(response: ResponseMessage): ExcludedItemInfo[] {
  return postprocessResult(response.type == "TextContents" ?
    response.contents.split(path.delimiter)
      .filter(id => id?.length > 0)
      .map(id => ({id, value:cvtPath(id)})) : []);
}

export function excludedItemsFromProject(project?: IdeProject): ExcludedItemInfo[] {
  if (project?.isKliveProject !== true) return [];

  const root = project.folderPath;
  return postprocessResult(project.excludedItems?.map(id => {
    const value = cvtPath(id);
    return {
      id,
      value,
      missing: !fs.existsSync(path.join(root, value))
    };
  }) ?? []);
}

const cvtPath = (id: string) => id.replace('/', path.sep);
const postprocessResult = (result: ExcludedItemInfo[]): ExcludedItemInfo[] => {
  result.sort((a, b) => a.value.localeCompare(b.value));
  return result;
}
