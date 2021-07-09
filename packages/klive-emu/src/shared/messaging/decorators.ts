export type ChannelDescriptor = {
  target: ICommunicationChannel;
  channelName: string;
  fromMain: boolean;
};

export const channelsDefined = new Map<string, ICommunicationChannel>();

export interface ICommunicationChannel {
  readonly target: Function & Record<string, any>;
  readonly channelName?: string;
  readonly fromMain?: boolean;
}

/**
 * Assign transformation information to a TransformBase-derived class
 * * @param paneType The pane type id to store
 */
export function CommunicationChannel(
  channelName: string,
  fromMain: boolean = true
) {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  return function <T extends { new (...args: any[]): Record<string, any> }>(
    constructor: T
  ) {
    const newClass = class extends constructor {
      channelName = channelName;
      fromMain = fromMain;
    };
    const singletonInstance = new newClass();

    channelsDefined.set(
      channelName,
      singletonInstance as ICommunicationChannel
    );
  };
}

@CommunicationChannel("myChannel")
class MyCommChannel {}

console.log(channelsDefined.get("myChannel"));
