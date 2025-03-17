"use client";
import { createContext, useContext, ReactNode } from "react";
import { useWebRTC } from "../utils/webrtc";
import { useState } from "react";
import * as Y from "yjs";

interface WebRTCContextType {
  ydoc: Y.Doc;
  roomId: string;
  setRoomId: (value: string) => void;
  joined: boolean;
  setJoined: (value: boolean) => void;
  activeUsers: number;
  setActiveUsers: React.Dispatch<React.SetStateAction<number>>;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export const WebRTCProvider = ({ children }: { children: ReactNode }) => {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0); 
  const [ydoc] = useState(() => new Y.Doc());

  useWebRTC(roomId, joined, ydoc, setActiveUsers);

  return (
    <WebRTCContext.Provider value={{ ydoc, roomId, setRoomId, joined, setJoined, activeUsers, setActiveUsers }}>
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTCContext = () => {
  const context = useContext(WebRTCContext);
  if (!context) throw new Error("useWebRTCContext must be used within a WebRTCProvider");
  return context;
};
