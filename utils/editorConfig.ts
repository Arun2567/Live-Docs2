'use client';

import { useEditor, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import TextStyle from "@tiptap/extension-text-style";
import LineHeight from "tiptap-extension-line-height";
import { useWebRTCContext } from "@/context/WebRTCContext";
import Collaboration from "@tiptap/extension-collaboration";

interface EditorOptions {
  content?: string;
}

export const useCustomEditor = ({ content = "<p>Write Here...</p>" }: EditorOptions = {}): Editor | null => {
  const { ydoc } = useWebRTCContext();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3], 
        },
      }),
      Collaboration.configure({ document: ydoc }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      FontFamily,
      LineHeight,
    ],
    content,
    editable: true,
    
  });
  return editor;
};