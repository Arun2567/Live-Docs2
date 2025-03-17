'use client';

import Toolbar from "@/app/components/toolBar"; 
import { useCustomEditor } from "@/utils/editorConfig";
import { EditorContent } from "@tiptap/react";
import { useParams } from "next/navigation";
import { useWebRTCContext } from "@/context/WebRTCContext";
import { useEffect } from "react";

export default function Create() {
  const { roomId: urlRoomId } = useParams();
  const { roomId, setRoomId, joined, setJoined } = useWebRTCContext();
  const editor = useCustomEditor();

  useEffect(() => {
    if (urlRoomId && urlRoomId !== roomId) {
      setRoomId(urlRoomId as string); 
      if (!joined) setJoined(true);
    }
  }, [urlRoomId, roomId, setRoomId, joined, setJoined]);

  return (
    <div className="h-[100vh] w-full">
      <Toolbar editor={editor} />
      <div className="h-[85vh] w-full flex justify-center py-5 items-center overflow-y-auto">
        <div className="h-full w-[50%] bg-gray-200 border rounded-xl">
          <div className="h-[150%] w-full bg-gray-300 border rounded-xl text-black px-5 py-2">
            {editor ? (
              <EditorContent
                editor={editor}
                className="prose max-w-none w-full h-[150%] text-xl leading-8 break-words whitespace-pre-wrap [&_*]:border-none [&_*]:outline-none"
              />
            ) : (
              <div>Loading...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}