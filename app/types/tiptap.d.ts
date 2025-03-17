declare module 'tiptap-extension-line-height' {
    import { Extension } from '@tiptap/core';
  
    interface LineHeightOptions {
      types?: string[];
      heights?: string[];
      defaultHeight?: string;
    }
  
    interface LineHeightCommands {
      setLineHeight: (height: string) => ({ commands }: { commands: any }) => boolean;
      unsetLineHeight: () => ({ commands }: { commands: any }) => boolean;
    }
  
    const LineHeight: Extension<LineHeightOptions> & {
      addCommands: () => LineHeightCommands;
    };
    export default LineHeight;
  }