import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

// Replace with your deployed Render server URL
const SOCKET_SERVER_URL = "https://callapp-apl7.onrender.com";

export default function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const localStreamRef = useRef(null);

  const ROOM_ID = "room1"; // fixed room for 2 participants

  useEffect(() => {
    const s = io(SOCKET_SERVER_URL);
    setSocket(s);

    // Get local camera/mic
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideoRef.current.srcObject = stream;
        localStreamRef.current = stream;
      });

    return () => s.disconnect();
  }, []);

  useEffect(() => {
    if (!socket || !localStreamRef.current) return;

    const pc = new RTCPeerConnection();

    // Add local tracks
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    // Set remote stream
    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    // Send ICE candidates to other peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { roomId: ROOM_ID, data: { candidate: event.candidate } });
      }
    };

    setPeerConnection(pc);

    // Listen for signaling data
    socket.on("signal", async ({ data }) => {
      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", { roomId: ROOM_ID, data: { sdp: answer } });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding ICE candidate", e);
        }
      }
    });

    // Join the room
    socket.emit("join", ROOM_ID);

    return () => {
      pc.close();
    };
  }, [socket]);

  return (
    <div style={{ display: "flex", justifyContent: "space-around", marginTop: "20px" }}>
      <div>
        <h3>Local</h3>
        <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "300px" }} />
      </div>
      <div>
        <h3>Remote</h3>
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "300px" }} />
      </div>
    </div>
  );
}
