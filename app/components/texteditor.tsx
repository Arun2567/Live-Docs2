"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import TextAlign from "@tiptap/extension-text-align";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { useEffect, useRef, useState } from "react";

const SIGNALING_SERVER_URL = "wss://bc5b-120-138-12-63.ngrok-free.app";

const ydoc = new Y.Doc(); // Yjs Document

function TextEditor() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (joined) {
      console.log("Connecting to signaling server...");
      socket.current = new WebSocket(SIGNALING_SERVER_URL);

      socket.current.onopen = () => {
        console.log("Connected to signaling server");
        socket.current?.send(JSON.stringify({ type: "join", room: roomId }));
      };

      socket.current.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        console.log("Received WebSocket message:", data);

        if (data.type === "new-peer") {
          console.log("New peer joined, creating offer...");
          createOffer();
        } else if (data.type === "offer") {
          console.log("Received offer, creating answer...");
          await createAnswer(data.offer);
        } else if (data.type === "answer") {
          console.log("Received answer, setting remote description...");
          peerConnection.current?.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } else if (data.type === "candidate") {
          console.log("Received ICE candidate, adding...");
          peerConnection.current?.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        }
      };

      socket.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
      };

      socket.current.onclose = () => {
        console.log("WebSocket closed.");
      };

      setupPeerConnection();
    }

    // Sync Yjs updates when they occur
    ydoc.on("update", (update) => {
      if (dataChannel.current?.readyState === "open") {
        console.log("Sending Yjs update to peer...");
        dataChannel.current.send(update);
      }
    });

    return () => {
      console.log("🔴 Cleanup: Closing WebSocket and PeerConnection");
      peerConnection.current?.close();
      socket.current?.close();
      dataChannel.current?.close();
    };
  }, [joined]);

  const setupPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Create a DataChannel for Yjs sync
    dataChannel.current = peerConnection.current.createDataChannel("yjs-sync");

    // Handle DataChannel events
    dataChannel.current.onopen = () => {
      console.log("DataChannel opened!");
    };

    dataChannel.current.onmessage = (event) => {
      console.log("Received Yjs update from peer:", event.data);
      Y.applyUpdate(ydoc, new Uint8Array(event.data));
    };

    dataChannel.current.onclose = () => {
      console.log("DataChannel closed.");
    };

    // Handle incoming DataChannel from the other peer
    peerConnection.current.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      dataChannel.current.onmessage = (event) => {
        console.log("Received Yjs update from peer:", event.data);
        Y.applyUpdate(ydoc, new Uint8Array(event.data));
      };
      dataChannel.current.onopen = () => {
        console.log("Incoming DataChannel opened!");
      };
      dataChannel.current.onclose = () => {
        console.log("Incoming DataChannel closed.");
      };
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.send(
          JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
            room: roomId,
          })
        );
      }
    };
  };

  const createOffer = async () => {
    const offer = await peerConnection.current!.createOffer();
    await peerConnection.current!.setLocalDescription(offer);
    socket.current?.send(
      JSON.stringify({ type: "offer", offer, room: roomId })
    );
  };

  const createAnswer = async (offer: RTCSessionDescriptionInit) => {
    await peerConnection.current!.setRemoteDescription(
      new RTCSessionDescription(offer)
    );
    const answer = await peerConnection.current!.createAnswer();
    await peerConnection.current!.setLocalDescription(answer);
    socket.current?.send(
      JSON.stringify({ type: "answer", answer, room: roomId })
    );
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Strike,
      Document,
      Paragraph,
      Text,
      Heading,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Collaboration.configure({ document: ydoc }), // Enable Yjs Collaboration
    ],
    content: "<p>Start writing...</p>",
  });

  return (
    <div className="w-1/2 h-[75vh] bg-gray-200">
      <div className="w-full h-1/6 bg-gray-400 flex flex-row">
        <div className="w-1/2 h-full flex justify-start items-center p-2">
          <input
            type="text"
            placeholder="Room Name"
            className="w-3/4 h-8 px-2 text-black bg-white border border-gray-300 rounded-lg focus:outline-none"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button
            onClick={() => setJoined(true)}
            className="h-8 w-1/4 ml-2 bg-blue-500 text-white rounded"
          >
            {joined ? "Connected" : "Join"}
          </button>
        </div>
      </div>

      <div className="w-full h-5/6 text-black p-5">
        <EditorContent
          editor={editor}
          className="prose max-w-none w-full h-full text-xl leading-8 break-words whitespace-pre-wrap"
        />
      </div>
    </div>
  );
}

export default TextEditor;


// "use client";
// import { useEditor, EditorContent } from "@tiptap/react";
// import StarterKit from "@tiptap/starter-kit";
// import Underline from "@tiptap/extension-underline";
// import Strike from "@tiptap/extension-strike";
// import TextAlign from "@tiptap/extension-text-align";
// import Document from "@tiptap/extension-document";
// import Heading from "@tiptap/extension-heading";
// import Paragraph from "@tiptap/extension-paragraph";
// import Text from "@tiptap/extension-text";
// import Collaboration from "@tiptap/extension-collaboration";
// import * as Y from "yjs";
// import { useEffect, useRef, useState } from "react";

// const SIGNALING_SERVER_URL = "wss://bc5b-120-138-12-63.ngrok-free.app"; 

// const ydoc = new Y.Doc(); // Yjs Document

// function TextEditor() {
//   const [roomId, setRoomId] = useState("");
//   const [joined, setJoined] = useState(false);
//   const peerConnection = useRef<RTCPeerConnection | null>(null);
//   const socket = useRef<WebSocket | null>(null);

//   useEffect(() => {
//     if (joined) {
//       console.log("Connecting to signaling server...");
//       socket.current = new WebSocket(SIGNALING_SERVER_URL);
  
//       socket.current.onopen = () => {
//         console.log("Connected to signaling server");
//         socket.current?.send(JSON.stringify({ type: "join", room: roomId }));
//       };
  
//       socket.current.onmessage = async (message) => {
//         const data = JSON.parse(message.data);
//         console.log("Received WebSocket message:", data);
  
//         if (data.type === "new-peer") {
//           console.log("New peer joined, creating offer...");
//           createOffer();
//         } else if (data.type === "offer") {
//           console.log("Received offer, creating answer...");
//           await createAnswer(data.offer);
//         } else if (data.type === "answer") {
//           console.log("Received answer, setting remote description...");
//           peerConnection.current?.setRemoteDescription(
//             new RTCSessionDescription(data.answer)
//           );
//         } else if (data.type === "candidate") {
//           console.log("Received ICE candidate, adding...");
//           peerConnection.current?.addIceCandidate(
//             new RTCIceCandidate(data.candidate)
//           );
//         }
//       };
  
//       socket.current.onerror = (error) => {
//         console.error("WebSocket Error:", error);
//       };
  
//       socket.current.onclose = () => {
//         console.log("WebSocket closed.");
//       };
  
//       setupPeerConnection();
//     }
  

//     return () => {
//       console.log("🔴 Cleanup: Closing WebSocket and PeerConnection");
//       peerConnection.current?.close();
//       socket.current?.close();
//     };
  
// }, [joined]);
  

//   const setupPeerConnection = () => {
//     peerConnection.current = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });

//     peerConnection.current.onicecandidate = (event) => {
//       if (event.candidate) {
//         socket.current?.send(
//           JSON.stringify({ type: "candidate", candidate: event.candidate, room: roomId })
//         );
//       }
//     };
//   };

//   const createOffer = async () => {
//     const offer = await peerConnection.current!.createOffer();
//     await peerConnection.current!.setLocalDescription(offer);

//     socket.current?.send(JSON.stringify({ type: "offer", offer, room: roomId }));
//   };

//   const createAnswer = async (offer: RTCSessionDescriptionInit) => {
//     await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(offer));

//     const answer = await peerConnection.current!.createAnswer();
//     await peerConnection.current!.setLocalDescription(answer);

//     socket.current?.send(JSON.stringify({ type: "answer", answer, room: roomId }));
//   };

//   const editor = useEditor({
//     extensions: [
//       StarterKit,
//       Underline,
//       Strike,
//       Document,
//       Paragraph,
//       Text,
//       Heading,
//       TextAlign.configure({ types: ["heading", "paragraph"] }),
//       Collaboration.configure({ document: ydoc }), // Enable Yjs Collaboration
//     ],
//     content: "<p>Start writing...</p>",
//   });

//   return (
//     <div className="w-1/2 h-[75vh] bg-gray-200">
//       <div className="w-full h-1/6 bg-gray-400 flex flex-row">
//         <div className="w-1/2 h-full flex justify-start items-center p-2">
//           <input
//             type="text"
//             placeholder="Room Name"
//             className="w-3/4 h-8 px-2 text-black bg-white border border-gray-300 rounded-lg focus:outline-none"
//             value={roomId}
//             onChange={(e) => setRoomId(e.target.value)}
//           />
//           <button onClick={() => setJoined(true)} className="h-8 w-1/4 ml-2 bg-blue-500 text-white rounded">
//             {joined ? "Connected" : "Join"}
//           </button>
//         </div>
//       </div>

//       <div className="w-full h-5/6 text-black p-5">
//         <EditorContent
//           editor={editor}
//           className="prose max-w-none w-full h-full text-xl leading-8 break-words whitespace-pre-wrap"
//         />
//       </div>
//     </div>
//   );
// }

// export default TextEditor;


// "use client";
// import { FaAlignLeft, FaAlignCenter, FaAlignRight, FaAlignJustify } from "react-icons/fa";
// import { useEditor, EditorContent } from "@tiptap/react";
// import StarterKit from "@tiptap/starter-kit";
// import Underline from "@tiptap/extension-underline";
// import Strike from "@tiptap/extension-strike";
// import TextAlign from "@tiptap/extension-text-align";
// import Document from '@tiptap/extension-document';
// import Heading from '@tiptap/extension-heading';
// import Paragraph from '@tiptap/extension-paragraph';
// import Text from '@tiptap/extension-text';
// import Collaboration from "@tiptap/extension-collaboration";
// import { WebrtcProvider } from "y-webrtc";
// import * as Y from "yjs";
// import { useEffect, useRef, useState } from "react";

// const SIGNALING_SERVER_URL = "wss://random-id.ngrok.io"; 

// const ydoc = new Y.Doc();
// // const provider = new WebrtcProvider("room-name", ydoc);

// function TextEditor() {
//   const [roomId, setRoomId] = useState("");
//   const [joined, setJoined] = useState(false);
//   const peerConnection = useRef<RTCPeerConnection | null>(null);
//   const socket = useRef<WebSocket | null>(null);


//   useEffect(() => {
//     if (joined) {
//       socket.current = new WebSocket(SIGNALING_SERVER_URL);

//       socket.current.onopen = () => {
//         console.log("Connected to WebSocket server");
//         socket.current?.send(JSON.stringify({ type: "join", room: roomId }));
//       };

//       socket.current.onmessage = async (message) => {
//         const data = JSON.parse(message.data);
//         if (data.type === "new-peer") {
//           createOffer();
//         } else if (data.type === "offer") {
//           await createAnswer(data.offer);
//         } else if (data.type === "answer") {
//           peerConnection.current?.setRemoteDescription(
//             new RTCSessionDescription(data.answer)
//           );
//         } else if (data.type === "candidate") {
//           peerConnection.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
//         }
//       };

//       setupPeerConnection();
//     }

//     return () => {
//       peerConnection.current?.close();
//       socket.current?.close();
//     };
//   }, [joined]);

//   const setupPeerConnection = async () => {
//     peerConnection.current = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });

//     peerConnection.current.onicecandidate = (event) => {
//       if (event.candidate) {
//         socket.current?.send(
//           JSON.stringify({ type: "candidate", candidate: event.candidate, room: roomId })
//         );
//       }
//     };};

//   const editor = useEditor({
//     extensions: [
//       StarterKit,
//       Underline,
//       Strike,
//       Document,
//       Paragraph,
//       Text,
//       Heading,
//       TextAlign.configure({
//         types: ["heading", "paragraph"],
//       }),
//       Collaboration.configure({
//          document: ydoc 
//         })
//     ],
//     content: "<p>Write here....</p>",
//   });

//   if (!editor) {
//     return <div>Loading editor...</div>;
//   }

//   const createOffer = async () => {
//     const offer = await peerConnection.current!.createOffer();
//     await peerConnection.current!.setLocalDescription(offer);

//     socket.current?.send(JSON.stringify({ type: "offer", offer, room: roomId }));
//   };

//   const createAnswer = async (offer: RTCSessionDescriptionInit) => {
//     await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(offer));

//     const answer = await peerConnection.current!.createAnswer();
//     await peerConnection.current!.setLocalDescription(answer);

//     socket.current?.send(JSON.stringify({ type: "answer", answer, room: roomId }));
//   };

//   return (
//     <div className="w-1/2 h-[75vh] bg-gray-200">
//       <div className="w-full h-1/6 bg-gray-400 flex flex-row">
//         <div className="w-1/2 h-full">
//           <div className="h-1/2 w-full bg-red-100 flex justify-evenly items-center">
//             <button
//               onClick={() => editor.chain().focus().toggleBold().run()}
//               className={`bold ${editor.isActive("bold") ? "buttons-active" : "buttons-inactive"}`}
//             >
//               B
//             </button>
//             <button
//               onClick={() => editor.chain().focus().toggleItalic().run()}
//               className={`italic ${editor.isActive("italic") ? "buttons-active" : "buttons-inactive"}`}
//             >
//               I
//             </button>
//             <button
//               onClick={() => editor.chain().focus().toggleUnderline().run()}
//               className={`underline ${editor.isActive("underline") ? "buttons-active" : "buttons-inactive"}`}
//             >
//               U
//             </button>
//             <button
//               onClick={() => editor.chain().focus().toggleStrike().run()}
//               className={`line-through ${editor.isActive("strike") ? "buttons-active" : "buttons-inactive"}`}
//             >
//               S
//             </button>
//           </div>
//           <div className="h-1/2 w-full bg-red-100 flex justify-evenly items-center">
//             <button
//               onClick={() => editor.chain().focus().setTextAlign("left").run()}
//               className={`${editor.isActive({ textAlign: "left" }) ? "buttons-active" : "buttons-inactive"}`}
//             >
//               <FaAlignLeft className={`${editor.isActive({ textAlign: "left" }) ? "text-white" : "text-black"}`} />
//             </button>
//             <button
//               onClick={() => editor.chain().focus().setTextAlign("center").run()}
//               className={`${editor.isActive({ textAlign: "center" }) ? "buttons-active" : "buttons-inactive"}`}
//             >
//               <FaAlignCenter className={`${editor.isActive({ textAlign: "center" }) ? "text-white" : "text-black"}`} />
//             </button>
//             <button
//               onClick={() => editor.chain().focus().setTextAlign("right").run()}
//               className={`${editor.isActive({ textAlign: "right" }) ? "buttons-active" : "buttons-inactive"}`}
//             >
//               <FaAlignRight className={`${editor.isActive({ textAlign: "right" }) ? "text-white" : "text-black"}`} />
//             </button>
//             <button
//               onClick={() => editor.chain().focus().setTextAlign("justify").run()}
//               className={`${editor.isActive({ textAlign: "justify" }) ? "buttons-active" : "buttons-inactive"}`}
//             >
//               <FaAlignJustify className={`${editor.isActive({ textAlign: "justify" }) ? "text-white" : "text-black"}`} />
//             </button>
//           </div>
//         </div>
//         <div className="w-1/2 h-full">
//         <div className="h-1/2 w-full flex justify-start items-center">
//         <input
//           type="text"
//           placeholder="Room Name"
//           className="w-3/4 h-8 ps-2 text-black bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none m-2"
//           />
//         <button className="h-8 w-1/4 me-2 bg-blue-400 rounded">Connect</button>  
//         </div>
//         <div className="h-1/2 w-full">

//         </div>
//         </div>
//       </div>
//       <div className="w-full h-5/6 text-black p-5">
//         <EditorContent
//           editor={editor}
//           className="prose max-w-none w-full h-full text-xl leading-8 break-words whitespace-pre-wrap [&_*]:border-none [&_*]:outline-none"
//         />
//       </div>
//     </div>
//   );
// }

// export default TextEditor;
