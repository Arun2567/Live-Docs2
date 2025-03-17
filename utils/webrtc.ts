"use client";
import { useEffect, useRef } from "react";
import * as Y from "yjs";

const SIGNALING_SERVER_URL = "wss://6672-120-138-12-35.ngrok-free.app";

export const useWebRTC = (
  roomId: string,
  joined: boolean,
  ydoc: Y.Doc,
  setActiveUsers: React.Dispatch<React.SetStateAction<number>>
) => {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const socket = useRef<WebSocket | null>(null);
  const localPeerId = useRef<string>(Math.random().toString(36).substring(2, 15));
  const isCleaningUp = useRef(false);

  const setupPeerConnection = (peerId: string) => {
    console.log(`Setting up PeerConnection for peer: ${peerId} in room: ${roomId}`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, 
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
          ],
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:turn.anyfirewall.com:443?transport=tcp",
          username: "webrtc",
          credential: "webrtc",
        },
      ],
      iceCandidatePoolSize: 10,
    });

    peerConnections.current.set(peerId, pc);

    const dc = pc.createDataChannel("yjs-sync", { negotiated: true, id: 0 });
    dataChannels.current.set(peerId, dc);

    dc.onopen = () => {
      console.log(`DataChannel opened with peer: ${peerId}`);
      const initialUpdate = Y.encodeStateAsUpdate(ydoc);
      dc.send(initialUpdate);
    };
    dc.onmessage = (event) => {
      console.log(`Received Yjs update from peer ${peerId}`);
      Y.applyUpdate(ydoc, new Uint8Array(event.data), "remote");
    };
    dc.onclose = () => console.log(`DataChannel closed with peer: ${peerId}`);
    dc.onerror = (error) => console.error(`DataChannel error with peer ${peerId}:`, error);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to peer ${peerId}:`, event.candidate.candidate);
        socket.current?.send(
          JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
            room: roomId,
            to: peerId,
            from: localPeerId.current,
          })
        );
      } else {
        console.log(`ICE candidate gathering complete for peer ${peerId}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with peer ${peerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.error(`ICE ${pc.iceConnectionState} with peer ${peerId}`);
        pc.restartIce();
      } else if (pc.iceConnectionState === "connected") {
        console.log(`ICE connected successfully with peer ${peerId}`);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`PeerConnection state with peer ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === "failed" && !isCleaningUp.current) {
        console.error(`PeerConnection failed with peer ${peerId}! ICE state: ${pc.iceConnectionState}`);
        console.error(`Local description:`, pc.localDescription?.sdp || "Not set");
        console.error(`Remote description:`, pc.remoteDescription?.sdp || "Not set");
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state with peer ${peerId}: ${pc.iceGatheringState}`);
    };

    return pc;
  };

  const createOffer = async (peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (!pc || pc.signalingState !== "stable") {
      console.log(`Cannot create offer for peer ${peerId}. Signaling state: ${pc?.signalingState}`);
      return;
    }
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(`Offer created for peer ${peerId}`);
      socket.current?.send(
        JSON.stringify({
          type: "offer",
          offer: pc.localDescription,
          room: roomId,
          to: peerId,
          from: localPeerId.current,
        })
      );
    } catch (error) {
      console.error(`Error creating offer for peer ${peerId}:`, error);
    }
  };

  const createAnswer = async (offer: RTCSessionDescriptionInit, fromPeerId: string) => {
    let pc = peerConnections.current.get(fromPeerId);
    if (!pc) {
      pc = setupPeerConnection(fromPeerId);
    }
    if (pc.signalingState !== "stable") {
      console.log(`Cannot create answer for peer ${fromPeerId}. Signaling state: ${pc.signalingState}`);
      return;
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log(`Answer created for peer ${fromPeerId}`);
      socket.current?.send(
        JSON.stringify({
          type: "answer",
          answer: pc.localDescription,
          room: roomId,
          to: fromPeerId,
          from: localPeerId.current,
        })
      );
    } catch (error) {
      console.error(`Error creating answer for peer ${fromPeerId}:`, error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit, fromPeerId: string) => {
    const pc = peerConnections.current.get(fromPeerId);
    if (!pc || pc.signalingState !== "have-local-offer") {
      console.log(`Cannot handle answer from peer ${fromPeerId}. Signaling state: ${pc?.signalingState}`);
      return;
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`Answer handled from peer ${fromPeerId}`);
    } catch (error) {
      console.error(`Error handling answer from peer ${fromPeerId}:`, error);
    }
  };

  const connectToSignalingServer = () => {
    console.log("Connecting to signaling server:", SIGNALING_SERVER_URL);
    socket.current = new WebSocket(SIGNALING_SERVER_URL);

    socket.current.onopen = () => {
      console.log("WebSocket connected");
      socket.current?.send(
        JSON.stringify({
          type: "join",
          room: roomId,
          peerId: localPeerId.current,
        })
      );
    };

    socket.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      console.log("Received message from server:", data.type);

      switch (data.type) {
        case "new-peer":
          if (data.peerId !== localPeerId.current) {
            const pc = setupPeerConnection(data.peerId);
            await createOffer(data.peerId);
          }
          break;
        case "offer":
          if (data.to === localPeerId.current) {
            await createAnswer(data.offer, data.from);
          }
          break;
        case "answer":
          if (data.to === localPeerId.current) {
            await handleAnswer(data.answer, data.from);
          }
          break;
        case "candidate":
          if (data.to === localPeerId.current) {
            const pc = peerConnections.current.get(data.from);
            if (pc) {
              console.log(`Received ICE candidate from peer ${data.from}:`, data.candidate.candidate);
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((err) =>
                console.error(`Error adding ICE candidate from peer ${data.from}:`, err)
              );
            }
          }
          break;
        case "active-users":
          setActiveUsers(data.count);
          console.log("Active users updated:", data.count);
          break;
      }
    };

    socket.current.onclose = (event) => {
      console.log("WebSocket closed. Code:", event.code, "Reason:", event.reason);
      if (joined && !isCleaningUp.current) {
        console.log("Reconnecting in 1s...");
        setTimeout(connectToSignalingServer, 1000);
      }
    };

    socket.current.onerror = (error) => {
      console.error("WebSocket error occurred:", error);
    };
  };

  useEffect(() => {
    if (joined && roomId) {
      console.log("Joining room:", roomId);
      connectToSignalingServer();
    }

    ydoc.on("update", (update, origin) => {
      if (origin !== "remote") {
        dataChannels.current.forEach((dc, peerId) => {
          if (dc.readyState === "open") {
            console.log(`Sending Yjs update to peer ${peerId}`);
            dc.send(update);
          }
        });
      }
    });

    return () => {
      console.log("Cleanup triggered for room:", roomId);
      isCleaningUp.current = true;
      peerConnections.current.forEach((pc, peerId) => {
        if (pc.connectionState !== "closed") {
          pc.close();
          console.log(`PeerConnection closed with peer ${peerId}`);
        }
      });
      dataChannels.current.forEach((dc, peerId) => {
        if (dc.readyState !== "closed") {
          dc.close();
          console.log(`DataChannel closed with peer ${peerId}`);
        }
      });
      if (socket.current && socket.current.readyState !== WebSocket.CLOSED) {
        socket.current.close();
        console.log("WebSocket closed");
      }
      peerConnections.current.clear();
      dataChannels.current.clear();
      isCleaningUp.current = false;
    };
  }, [joined, roomId, ydoc, setActiveUsers]);

  return { localPeerId: localPeerId.current };
};


// "use client";
// import { useEffect, useRef } from "react";
// import * as Y from "yjs";

// const SIGNALING_SERVER_URL = "wss://bd19-120-138-12-35.ngrok-free.app";

// export const useWebRTC = (
//   roomId: string,
//   joined: boolean,
//   ydoc: Y.Doc,
//   setActiveUsers: React.Dispatch<React.SetStateAction<number>>
// ) => {
//   const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
//   const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
//   const socket = useRef<WebSocket | null>(null);
//   const localPeerId = useRef<string>(Math.random().toString(36).substring(2, 15));
//   const isCleaningUp = useRef(false);

//   const setupPeerConnection = (peerId: string) => {
//     console.log(`Setting up PeerConnection for peer: ${peerId} in room: ${roomId}`);
//     const pc = new RTCPeerConnection({
//       iceServers: [
//         { urls: "stun:stun.l.google.com:19302" },
//         { urls: "stun:stun1.l.google.com:19302" },
//         {
//           urls: [
//             "turn:openrelay.metered.ca:80",
//             "turn:openrelay.metered.ca:443",
//             "turn:openrelay.metered.ca:443?transport=tcp",
//           ],
//           username: "openrelayproject",
//           credential: "openrelayproject",
//         },
//         {
//           urls: "turn:turn.anyfirewall.com:443?transport=tcp",
//           username: "webrtc",
//           credential: "webrtc",
//         },
//       ],
//       // Removed iceTransportPolicy: "relay" to allow host/srflx candidates
//       iceCandidatePoolSize: 10,
//     });

//     peerConnections.current.set(peerId, pc);

//     const dc = pc.createDataChannel("yjs-sync", { negotiated: true, id: 0 });
//     dataChannels.current.set(peerId, dc);

//     dc.onopen = () => {
//       console.log(`DataChannel opened with peer: ${peerId}`);
//       const initialUpdate = Y.encodeStateAsUpdate(ydoc);
//       dc.send(initialUpdate);
//     };
//     dc.onmessage = (event) => {
//       console.log(`Received Yjs update from peer ${peerId}`);
//       Y.applyUpdate(ydoc, new Uint8Array(event.data), "remote");
//     };
//     dc.onclose = () => console.log(`DataChannel closed with peer: ${peerId}`);
//     dc.onerror = (error) => console.error(`DataChannel error with peer ${peerId}:`, error);

//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         console.log(`Sending ICE candidate to peer ${peerId}:`, event.candidate.candidate);
//         socket.current?.send(
//           JSON.stringify({
//             type: "candidate",
//             candidate: event.candidate,
//             room: roomId,
//             to: peerId,
//             from: localPeerId.current,
//           })
//         );
//       } else {
//         console.log(`ICE candidate gathering complete for peer ${peerId}`);
//       }
//     };

//     pc.oniceconnectionstatechange = () => {
//       console.log(`ICE connection state with peer ${peerId}: ${pc.iceConnectionState}`);
//       if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
//         console.error(`ICE ${pc.iceConnectionState} with peer ${peerId}`);
//         pc.restartIce();
//       } else if (pc.iceConnectionState === "connected") {
//         console.log(`ICE connected successfully with peer ${peerId}`);
//       }
//     };

//     pc.onconnectionstatechange = () => {
//       console.log(`PeerConnection state with peer ${peerId}: ${pc.connectionState}`);
//       if (pc.connectionState === "failed" && !isCleaningUp.current) {
//         console.error(`PeerConnection failed with peer ${peerId}! ICE state: ${pc.iceConnectionState}`);
//         console.error(`Local description:`, pc.localDescription?.sdp || "Not set");
//         console.error(`Remote description:`, pc.remoteDescription?.sdp || "Not set");
//       }
//     };

//     pc.onicegatheringstatechange = () => {
//       console.log(`ICE gathering state with peer ${peerId}: ${pc.iceGatheringState}`);
//     };

//     return pc;
//   };

//   const createOffer = async (peerId: string) => {
//     const pc = peerConnections.current.get(peerId);
//     if (!pc || pc.signalingState !== "stable") {
//       console.log(`Cannot create offer for peer ${peerId}. Signaling state: ${pc?.signalingState}`);
//       return;
//     }
//     try {
//       const offer = await pc.createOffer();
//       await pc.setLocalDescription(offer);
//       console.log(`Offer created for peer ${peerId}`);
//       socket.current?.send(
//         JSON.stringify({
//           type: "offer",
//           offer: pc.localDescription,
//           room: roomId,
//           to: peerId,
//           from: localPeerId.current,
//         })
//       );
//     } catch (error) {
//       console.error(`Error creating offer for peer ${peerId}:`, error);
//     }
//   };

//   const createAnswer = async (offer: RTCSessionDescriptionInit, fromPeerId: string) => {
//     let pc = peerConnections.current.get(fromPeerId);
//     if (!pc) {
//       pc = setupPeerConnection(fromPeerId);
//     }
//     if (pc.signalingState !== "stable") {
//       console.log(`Cannot create answer for peer ${fromPeerId}. Signaling state: ${pc.signalingState}`);
//       return;
//     }
//     try {
//       await pc.setRemoteDescription(new RTCSessionDescription(offer));
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);
//       console.log(`Answer created for peer ${fromPeerId}`);
//       socket.current?.send(
//         JSON.stringify({
//           type: "answer",
//           answer: pc.localDescription,
//           room: roomId,
//           to: fromPeerId,
//           from: localPeerId.current,
//         })
//       );
//     } catch (error) {
//       console.error(`Error creating answer for peer ${fromPeerId}:`, error);
//     }
//   };

//   const handleAnswer = async (answer: RTCSessionDescriptionInit, fromPeerId: string) => {
//     const pc = peerConnections.current.get(fromPeerId);
//     if (!pc || pc.signalingState !== "have-local-offer") {
//       console.log(`Cannot handle answer from peer ${fromPeerId}. Signaling state: ${pc?.signalingState}`);
//       return;
//     }
//     try {
//       await pc.setRemoteDescription(new RTCSessionDescription(answer));
//       console.log(`Answer handled from peer ${fromPeerId}`);
//     } catch (error) {
//       console.error(`Error handling answer from peer ${fromPeerId}:`, error);
//     }
//   };

//   const connectToSignalingServer = () => {
//     console.log("Connecting to signaling server:", SIGNALING_SERVER_URL);
//     socket.current = new WebSocket(SIGNALING_SERVER_URL);

//     socket.current.onopen = () => {
//       console.log("WebSocket connected");
//       socket.current?.send(
//         JSON.stringify({
//           type: "join",
//           room: roomId,
//           peerId: localPeerId.current,
//         })
//       );
//     };

//     socket.current.onmessage = async (message) => {
//       const data = JSON.parse(message.data);
//       console.log("Received message from server:", data.type);

//       switch (data.type) {
//         case "new-peer":
//           if (data.peerId !== localPeerId.current) {
//             const pc = setupPeerConnection(data.peerId);
//             await createOffer(data.peerId);
//           }
//           break;
//         case "offer":
//           if (data.to === localPeerId.current) {
//             await createAnswer(data.offer, data.from);
//           }
//           break;
//         case "answer":
//           if (data.to === localPeerId.current) {
//             await handleAnswer(data.answer, data.from);
//           }
//           break;
//         case "candidate":
//           if (data.to === localPeerId.current) {
//             const pc = peerConnections.current.get(data.from);
//             if (pc) {
//               console.log(`Received ICE candidate from peer ${data.from}:`, data.candidate.candidate);
//               await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((err) =>
//                 console.error(`Error adding ICE candidate from peer ${data.from}:`, err)
//               );
//             }
//           }
//           break;
//         case "active-users":
//           setActiveUsers(data.count);
//           console.log("Active users updated:", data.count);
//           break;
//       }
//     };

//     socket.current.onclose = (event) => {
//       console.log("WebSocket closed. Code:", event.code, "Reason:", event.reason);
//       if (joined && !isCleaningUp.current) {
//         console.log("Reconnecting in 1s...");
//         setTimeout(connectToSignalingServer, 1000);
//       }
//     };

//     socket.current.onerror = (error) => {
//       console.error("WebSocket error occurred:", error);
//     };
//   };

//   useEffect(() => {
//     if (joined && roomId) {
//       console.log("Joining room:", roomId);
//       connectToSignalingServer();
//     }

//     ydoc.on("update", (update, origin) => {
//       if (origin !== "remote") {
//         dataChannels.current.forEach((dc, peerId) => {
//           if (dc.readyState === "open") {
//             console.log(`Sending Yjs update to peer ${peerId}`);
//             dc.send(update);
//           }
//         });
//       }
//     });

//     return () => {
//       console.log("Cleanup triggered for room:", roomId);
//       isCleaningUp.current = true;
//       peerConnections.current.forEach((pc, peerId) => {
//         if (pc.connectionState !== "closed") {
//           pc.close();
//           console.log(`PeerConnection closed with peer ${peerId}`);
//         }
//       });
//       dataChannels.current.forEach((dc, peerId) => {
//         if (dc.readyState !== "closed") {
//           dc.close();
//           console.log(`DataChannel closed with peer ${peerId}`);
//         }
//       });
//       if (socket.current && socket.current.readyState !== WebSocket.CLOSED) {
//         socket.current.close();
//         console.log("WebSocket closed");
//       }
//       peerConnections.current.clear();
//       dataChannels.current.clear();
//       isCleaningUp.current = false;
//     };
//   }, [joined, roomId, ydoc, setActiveUsers]);

//   return { localPeerId: localPeerId.current };
// };

// "use client";
// import { useEffect, useRef } from "react";
// import * as Y from "yjs";

// // Replace with your actual ngrok wss:// URL
// const SIGNALING_SERVER_URL = "wss://48f0-103-208-230-151.ngrok-free.app";

// export const useWebRTC = (
//   roomId: string,
//   joined: boolean,
//   ydoc: Y.Doc,
//   setActiveUsers: React.Dispatch<React.SetStateAction<number>>
// ) => {
//   const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
//   const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
//   const socket = useRef<WebSocket | null>(null);
//   const localPeerId = useRef<string>(Math.random().toString(36).substring(2, 15));
//   const isCleaningUp = useRef(false);

//   const setupPeerConnection = (peerId: string) => {
//     console.log(`Setting up PeerConnection for peer: ${peerId} in room: ${roomId}`);
//     const pc = new RTCPeerConnection({
//       iceServers: [
//         { urls: "stun:stun.l.google.com:19302" },
//         { urls: "stun:stun1.l.google.com:19302" },
//         { urls: "stun:stun2.l.google.com:19302" },
//         {
//           urls: [
//             "turn:openrelay.metered.ca:80",
//             "turn:openrelay.metered.ca:443",
//             "turn:openrelay.metered.ca:443?transport=tcp",
//           ],
//           username: "openrelayproject",
//           credential: "openrelayproject",
//         },
//         // Add a reliable TURN server if possible (example placeholder)
//         // {
//         //   urls: "turn:your-turn-server.example.com:3478",
//         //   username: "your-username",
//         //   credential: "your-password",
//         // },
//       ],
//       iceCandidatePoolSize: 10, // Pre-gather candidates
//     });

//     peerConnections.current.set(peerId, pc);

//     const dc = pc.createDataChannel("yjs-sync", { negotiated: true, id: 0 });
//     dataChannels.current.set(peerId, dc);

//     dc.onopen = () => {
//       console.log(`DataChannel opened with peer: ${peerId}`);
//       const initialUpdate = Y.encodeStateAsUpdate(ydoc);
//       dc.send(initialUpdate);
//     };
//     dc.onmessage = (event) => {
//       console.log(`Received Yjs update from peer ${peerId}`);
//       Y.applyUpdate(ydoc, new Uint8Array(event.data), "remote");
//     };
//     dc.onclose = () => console.log(`DataChannel closed with peer: ${peerId}`);
//     dc.onerror = (error) => console.error(`DataChannel error with peer ${peerId}:`, error);

//     pc.ondatachannel = (event) => {
//       const dc = event.channel;
//       dataChannels.current.set(peerId, dc);
//       dc.onmessage = (event) => {
//         console.log(`Received Yjs update from incoming DataChannel with peer ${peerId}`);
//         Y.applyUpdate(ydoc, new Uint8Array(event.data), "remote");
//       };
//       dc.onopen = () => console.log(`Incoming DataChannel opened with peer: ${peerId}`);
//       dc.onclose = () => console.log(`Incoming DataChannel closed with peer: ${peerId}`);
//       dc.onerror = (error) => console.error(`Incoming DataChannel error with peer ${peerId}:`, error);
//     };

//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         console.log(`Sending ICE candidate to peer ${peerId}:`, event.candidate.candidate);
//         socket.current?.send(
//           JSON.stringify({
//             type: "candidate",
//             candidate: event.candidate,
//             room: roomId,
//             to: peerId,
//             from: localPeerId.current,
//           })
//         );
//       } else {
//         console.log(`ICE candidate gathering complete for peer ${peerId}`);
//       }
//     };

//     pc.oniceconnectionstatechange = () => {
//       console.log(`ICE connection state with peer ${peerId}: ${pc.iceConnectionState}`);
//       if (pc.iceConnectionState === "failed") {
//         console.error(`ICE failed with peer ${peerId}`);
//         pc.restartIce();
//       } else if (pc.iceConnectionState === "disconnected") {
//         console.error(`ICE disconnected with peer ${peerId}`);
//         pc.restartIce();
//       } else if (pc.iceConnectionState === "connected") {
//         console.log(`ICE connected successfully with peer ${peerId}`);
//       }
//     };

//     pc.onconnectionstatechange = () => {
//       console.log(`PeerConnection state with peer ${peerId}: ${pc.connectionState}`);
//       if (pc.connectionState === "failed" && !isCleaningUp.current) {
//         console.error(`PeerConnection failed with peer ${peerId}! ICE state: ${pc.iceConnectionState}`);
//         console.error(`Local description:`, pc.localDescription?.sdp || "Not set");
//         console.error(`Remote description:`, pc.remoteDescription?.sdp || "Not set");
//       } else if (pc.connectionState === "connected") {
//         console.log(`PeerConnection fully established with peer ${peerId}`);
//       }
//     };

//     pc.onicegatheringstatechange = () => {
//       console.log(`ICE gathering state with peer ${peerId}: ${pc.iceGatheringState}`);
//     };

//     return pc;
//   };

//   const createOffer = async (peerId: string) => {
//     const pc = peerConnections.current.get(peerId);
//     if (!pc || pc.signalingState !== "stable") {
//       console.log(`Cannot create offer for peer ${peerId}. Signaling state: ${pc?.signalingState}`);
//       return;
//     }
//     try {
//       const offer = await pc.createOffer();
//       await pc.setLocalDescription(offer);
//       console.log(`Offer created for peer ${peerId}`);
//       socket.current?.send(
//         JSON.stringify({
//           type: "offer",
//           offer,
//           room: roomId,
//           to: peerId,
//           from: localPeerId.current,
//         })
//       );
//     } catch (error) {
//       console.error(`Error creating offer for peer ${peerId}:`, error);
//     }
//   };

//   const createAnswer = async (offer: RTCSessionDescriptionInit, fromPeerId: string) => {
//     let pc = peerConnections.current.get(fromPeerId);
//     if (!pc) {
//       pc = setupPeerConnection(fromPeerId);
//     }
//     if (pc.signalingState !== "stable") {
//       console.log(`Cannot create answer for peer ${fromPeerId}. Signaling state: ${pc.signalingState}`);
//       return;
//     }
//     try {
//       await pc.setRemoteDescription(new RTCSessionDescription(offer));
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);
//       console.log(`Answer created for peer ${fromPeerId}`);
//       socket.current?.send(
//         JSON.stringify({
//           type: "answer",
//           answer,
//           room: roomId,
//           to: fromPeerId,
//           from: localPeerId.current,
//         })
//       );
//     } catch (error) {
//       console.error(`Error creating answer for peer ${fromPeerId}:`, error);
//     }
//   };

//   const handleAnswer = async (answer: RTCSessionDescriptionInit, fromPeerId: string) => {
//     const pc = peerConnections.current.get(fromPeerId);
//     if (!pc || pc.signalingState !== "have-local-offer") {
//       console.log(`Cannot handle answer from peer ${fromPeerId}. Signaling state: ${pc?.signalingState}`);
//       return;
//     }
//     try {
//       await pc.setRemoteDescription(new RTCSessionDescription(answer));
//       console.log(`Answer handled from peer ${fromPeerId}`);
//     } catch (error) {
//       console.error(`Error handling answer from peer ${fromPeerId}:`, error);
//     }
//   };

//   const connectToSignalingServer = () => {
//     console.log("Connecting to signaling server:", SIGNALING_SERVER_URL);
//     socket.current = new WebSocket(SIGNALING_SERVER_URL);

//     socket.current.onopen = () => {
//       console.log("WebSocket connected");
//       socket.current?.send(
//         JSON.stringify({
//           type: "join",
//           room: roomId,
//           peerId: localPeerId.current,
//         })
//       );
//     };

//     socket.current.onmessage = async (message) => {
//       const data = JSON.parse(message.data);
//       console.log("Received message from server:", data.type);

//       switch (data.type) {
//         case "new-peer":
//           if (data.peerId !== localPeerId.current) {
//             const pc = setupPeerConnection(data.peerId);
//             await createOffer(data.peerId);
//           }
//           break;
//         case "offer":
//           if (data.to === localPeerId.current) {
//             await createAnswer(data.offer, data.from);
//           }
//           break;
//         case "answer":
//           if (data.to === localPeerId.current) {
//             await handleAnswer(data.answer, data.from);
//           }
//           break;
//         case "candidate":
//           if (data.to === localPeerId.current) {
//             const pc = peerConnections.current.get(data.from);
//             if (pc) {
//               await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((err) =>
//                 console.error(`Error adding ICE candidate from peer ${data.from}:`, err)
//               );
//             }
//           }
//           break;
//         case "active-users":
//           setActiveUsers(data.count);
//           console.log("Active users updated:", data.count);
//           break;
//       }
//     };

//     socket.current.onclose = (event) => {
//       console.log("WebSocket closed. Code:", event.code, "Reason:", event.reason);
//       if (joined && !isCleaningUp.current) {
//         console.log("Reconnecting in 1s...");
//         setTimeout(connectToSignalingServer, 1000);
//       }
//     };

//     socket.current.onerror = (error) => {
//       console.error("WebSocket error occurred:", error);
//     };
//   };

//   useEffect(() => {
//     if (joined && roomId) {
//       console.log("Joining room:", roomId);
//       connectToSignalingServer();
//     }

//     ydoc.on("update", (update, origin) => {
//       if (origin !== "remote") {
//         dataChannels.current.forEach((dc, peerId) => {
//           if (dc.readyState === "open") {
//             console.log(`Sending Yjs update to peer ${peerId}`);
//             dc.send(update);
//           }
//         });
//       }
//     });

//     return () => {
//       console.log("Cleanup triggered for room:", roomId);
//       isCleaningUp.current = true;
//       peerConnections.current.forEach((pc, peerId) => {
//         if (pc.connectionState !== "closed") {
//           pc.close();
//           console.log(`PeerConnection closed with peer ${peerId}`);
//         }
//       });
//       dataChannels.current.forEach((dc, peerId) => {
//         if (dc.readyState !== "closed") {
//           dc.close();
//           console.log(`DataChannel closed with peer ${peerId}`);
//         }
//       });
//       if (socket.current && socket.current.readyState !== WebSocket.CLOSED) {
//         socket.current.close();
//         console.log("WebSocket closed");
//       }
//       peerConnections.current.clear();
//       dataChannels.current.clear();
//       isCleaningUp.current = false;
//     };
//   }, [joined, roomId, ydoc, setActiveUsers]);

//   return { localPeerId: localPeerId.current };
// };





// "use client";
// import { useEffect, useRef } from "react";
// import * as Y from "yjs";

// // Use wss:// for WebSocket over ngrok (adjust based on your ngrok setup)
// const SIGNALING_SERVER_URL = "wss://8933-103-208-230-151.ngrok-free.app";

// export const useWebRTC = (
//   roomId: string,
//   joined: boolean,
//   ydoc: Y.Doc,
//   setActiveUsers: React.Dispatch<React.SetStateAction<number>>
// ) => {
//   const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
//   const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
//   const socket = useRef<WebSocket | null>(null);
//   const localPeerId = useRef<string>(Math.random().toString(36).substring(2, 15));
//   const isCleaningUp = useRef(false);

//   const setupPeerConnection = (peerId: string) => {
//     console.log(`Setting up PeerConnection for peer: ${peerId} in room: ${roomId}`);
//     const pc = new RTCPeerConnection({
//       iceServers: [
//         { urls: "stun:stun.l.google.com:19302" },
//         { urls: "stun:stun1.l.google.com:19302" }, // Add more STUN servers
//         {
//           urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443"],
//           username: "openrelayproject",
//           credential: "openrelayproject",
//         },
//         // Add a fallback TURN server (example—replace with real credentials if available)
//         {
//           urls: "turn:turn.example.com:3478",
//           username: "user",
//           credential: "pass",
//         },
//       ],
//     });

//     peerConnections.current.set(peerId, pc);

//     const dc = pc.createDataChannel("yjs-sync");
//     dataChannels.current.set(peerId, dc);

//     dc.onopen = () => {
//       console.log(`DataChannel opened with peer: ${peerId}`);
//       const initialUpdate = Y.encodeStateAsUpdate(ydoc);
//       dc.send(initialUpdate);
//     };
//     dc.onmessage = (event) => {
//       console.log(`Received Yjs update from peer ${peerId}`);
//       Y.applyUpdate(ydoc, new Uint8Array(event.data));
//     };
//     dc.onclose = () => console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~>DataChannel closed with peer: ${peerId}`);
//     dc.onerror = (error) => console.error(`------------------------------>DataChannel error with peer ${peerId}:`, error);

//     pc.ondatachannel = (event) => {
//       const dc = event.channel;
//       dataChannels.current.set(peerId, dc);
//       dc.onmessage = (event) => {
//         console.log(`Received Yjs update from incoming DataChannel with peer ${peerId}`);
//         Y.applyUpdate(ydoc, new Uint8Array(event.data));
//       };
//       dc.onopen = () => console.log(`Incoming DataChannel opened with peer: ${peerId}`);
//       dc.onclose = () => console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~>Incoming DataChannel closed with peer: ${peerId}`);
//       dc.onerror = (error) => console.error(`----------------------------->Incoming DataChannel error with peer ${peerId}:`, error);
//     };

//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         console.log(`Sending ICE candidate to peer ${peerId}:`, event.candidate.candidate);
//         socket.current?.send(
//           JSON.stringify({
//             type: "candidate",
//             candidate: event.candidate,
//             room: roomId,
//             to: peerId,
//             from: localPeerId.current,
//           })
//         );
//       }
//     };

//     pc.oniceconnectionstatechange = () => {
//       console.log(`ICE connection state with peer ${peerId}: ${pc.iceConnectionState}`);
//       if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
//         console.error(`ICE connection issue with peer ${peerId}: ${pc.iceConnectionState}`);
//       }
//     };

//     pc.onconnectionstatechange = () => {
//       console.log(`PeerConnection state with peer ${peerId}: ${pc.connectionState}`);
//       if (pc.connectionState === "failed" && !isCleaningUp.current) {
//         console.error(`------------------------------------>PeerConection failed with peer ${peerId}! ICE state: ${pc.iceConnectionState}`);
//         console.error(`Local description:`, pc.localDescription?.sdp || "Not set");
//         console.error(`Remote description:`, pc.remoteDescription?.sdp || "Not set");
//       }
//     };

//     return pc;
//   };

//   const createOffer = async (peerId: string) => {
//     const pc = peerConnections.current.get(peerId);
//     if (!pc || pc.signalingState !== "stable") {
//       console.log(`----------------------------------------->Cannot create offer for peer ${peerId}. Signaling state: ${pc?.signalingState}`);
//       return;
//     }
//     try {
//       const offer = await pc.createOffer();
//       await pc.setLocalDescription(offer);
//       console.log(`Offer created for peer ${peerId}`);
//       socket.current?.send(
//         JSON.stringify({
//           type: "offer",
//           offer,
//           room: roomId,
//           to: peerId,
//           from: localPeerId.current,
//         })
//       );
//     } catch (error) {
//       console.error(`------------------------------->Error creating offer for peer ${peerId}:`, error);
//     }
//   };

//   const createAnswer = async (offer: RTCSessionDescriptionInit, fromPeerId: string) => {
//     let pc = peerConnections.current.get(fromPeerId);
//     if (!pc) {
//       pc = setupPeerConnection(fromPeerId);
//     }
//     if (pc.signalingState !== "stable") {
//       console.log(`----------------------------------->Cannot create answer for peer ${fromPeerId}. Signaling state: ${pc.signalingState}`);
//       return;
//     }
//     try {
//       await pc.setRemoteDescription(new RTCSessionDescription(offer));
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);
//       console.log(`Answer created for peer ${fromPeerId}`);
//       socket.current?.send(
//         JSON.stringify({
//           type: "answer",
//           answer,
//           room: roomId,
//           to: fromPeerId,
//           from: localPeerId.current,
//         })
//       );
//     } catch (error) {
//       console.error(`----------------------------------->Error creating answer for peer ${fromPeerId}:`, error);
//     }
//   };

//   const handleAnswer = async (answer: RTCSessionDescriptionInit, fromPeerId: string) => {
//     const pc = peerConnections.current.get(fromPeerId);
//     if (!pc || pc.signalingState !== "have-local-offer") {
//       console.log(`--------------------------------->Cannot handle answer from peer ${fromPeerId}. Signaling state: ${pc?.signalingState}`);
//       return;
//     }
//     try {
//       await pc.setRemoteDescription(new RTCSessionDescription(answer));
//       console.log(`Answer handled from peer ${fromPeerId}`);
//     } catch (error) {
//       console.error(`-------------------------------->Error handling answer from peer ${fromPeerId}:`, error);
//     }
//   };

//   const connectToSignalingServer = () => {
//     console.log("Connecting to signaling server:", SIGNALING_SERVER_URL);
//     socket.current = new WebSocket(SIGNALING_SERVER_URL);

//     socket.current.onopen = () => {
//       console.log("WebSocket connected");
//       socket.current?.send(
//         JSON.stringify({
//           type: "join",
//           room: roomId,
//           peerId: localPeerId.current,
//         })
//       );
//     };

//     socket.current.onmessage = async (message) => {
//       const data = JSON.parse(message.data);
//       console.log("Received message from server:", data.type);

//       switch (data.type) {
//         case "new-peer":
//           if (data.peerId !== localPeerId.current) {
//             const pc = setupPeerConnection(data.peerId);
//             await createOffer(data.peerId);
//           }
//           break;
//         case "offer":
//           if (data.to === localPeerId.current) {
//             await createAnswer(data.offer, data.from);
//           }
//           break;
//         case "answer":
//           if (data.to === localPeerId.current) {
//             await handleAnswer(data.answer, data.from);
//           }
//           break;
//         case "candidate":
//           if (data.to === localPeerId.current) {
//             const pc = peerConnections.current.get(data.from);
//             if (pc) {
//               await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((err) =>
//                 console.error(`Error adding ICE candidate from peer ${data.from}:`, err)
//               );
//             }
//           }
//           break;
//         case "active-users":
//           setActiveUsers(data.count);
//           console.log("Active users updated:", data.count);
//           break;
//       }
//     };

//     socket.current.onclose = (event) => {
//       console.log("--------------------------->WebSocket closed. Code:", event.code, "Reason:", event.reason);
//       if (joined && !isCleaningUp.current) {
//         console.log("Reconnecting in 1s...");
//         setTimeout(connectToSignalingServer, 1000);
//       }
//     };

//     socket.current.onerror = (error) => {
//       console.error("------------------------------>WebSocket error occurred:", error);
//     };
//   };

//   useEffect(() => {
//     if (joined) {
//       console.log("Joining room:", roomId);
//       connectToSignalingServer();
//     }

//     ydoc.on("update", (update, origin) => {
//       if (origin !== "remote") { // Avoid infinite loops
//         dataChannels.current.forEach((dc, peerId) => {
//           if (dc.readyState === "open") {
//             console.log(`Sending Yjs update to peer ${peerId}`);
//             dc.send(update);
//           }
//         });
//       }
//     });

//     return () => {
//       console.log("Cleanup triggered for room:", roomId);
//       isCleaningUp.current = true;
//       peerConnections.current.forEach((pc, peerId) => {
//         if (pc.connectionState !== "closed") {
//           pc.close();
//           console.log(`PeerConnection closed with peer ${peerId}`);
//         }
//       });
//       dataChannels.current.forEach((dc, peerId) => {
//         if (dc.readyState !== "closed") {
//           dc.close();
//           console.log(`DataChannel closed with peer ${peerId}`);
//         }
//       });
//       if (socket.current && socket.current.readyState !== WebSocket.CLOSED) {
//         socket.current.close();
//         console.log("WebSocket closed");
//       }
//       peerConnections.current.clear();
//       dataChannels.current.clear();
//       isCleaningUp.current = false;
//     };
//   }, [joined, roomId, ydoc, setActiveUsers]);

//   return { localPeerId: localPeerId.current };
// };
