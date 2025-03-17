'use client'
import { useState } from "react";
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { useWebRTC } from '../../utils/webrtc'
import { useWebRTCContext } from "@/context/WebRTCContext";

export default function Header(){
    const [JoinMeet, setJoinMeet] = useState(false);
    const { roomId, setRoomId, setJoined } = useWebRTCContext();

    const router = useRouter();

    const toggleJoinMeet = () => {
         setJoinMeet((prev)=>!prev);
    }

    const createDoc = () => {
      const hashvalue = Math.random().toString(36).substring(2, 10);
      setRoomId(hashvalue); 
      setJoined(true); 
      router.push(`/Home/${hashvalue}`);
    };
  
    const joinRoom = () => {
      if (roomId) {
        setJoined(true); 
        router.push(`/Home/${roomId}`); 
        setJoinMeet(false);
      } else {
        alert("Please enter a meeting code.");
      }
    };
    return(
    <header className="h-[10vh] w-full relative ">
     <ul className="h-full flex flex-row items-center justify-end">
      <li className="px-5 py-2 mx-5  cursor-pointer  bg-gray-400 text-black  flex flex-row items-center  justify-center rounded-md">Home</li>
      <li onClick={createDoc} className="px-5  cursor-pointer hover:text-xl transition-all duration-200">Create</li>
      <li className="relative px-5" >
          <span onClick={toggleJoinMeet} className="cursor-pointer hover:text-xl transition-all duration-200"> Join</span>
          {JoinMeet && (
            <div className="absolute top-[150%] left-1/2 -translate-x-[95%] mt-2 w-80 bg-gray-400 text-black text-center p-4 rounded-md shadow-lg z-10 flex flex-row justify-evenly">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter Meeting Code"
                className="w-[60%] h-[60%] p-2 rounded-md border border-gray-900"
              />
              <button onClick={joinRoom} className="cursor-pointer px-4 py-1 bg-blue-500 text-white rounded-md">
                Join
              </button>
            </div>
          )}
        </li>
      <li className="pl-5   pr-10 cursor-pointer hover:text-xl transition-all duration-200">Profile</li>

     </ul>
    </header>
    );
}