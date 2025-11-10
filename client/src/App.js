import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SOCKET_SERVER_URL = "https://callapp-apl7.onrender.com";
const ROOM_ID = "room1"; // fixed room for 2 participants

export default function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // 1. Connect to Socket.io
    const socket = io(SOCKET_SERVER_URL);
    socketRef.current = socket;

    // 2. Get local camera/mic
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideoRef.current.srcObject = stream;
        localStreamRef.current = stream;

        // 3. Join room after stream is ready
        socket.emit("join", ROOM_ID);
      });

    // 4. Handle signaling data
    socket.on("signal", async ({ data }) => {
      const pc = pcRef.current;
      if (!pc) return;

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

    // 5. Listen for the "peer-joined" event
    socket.on("peer-joined", async () => {
      if (pcRef.current) return; // already have a peer connection

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Add local tracks
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

      // Remote track
      pc.ontrack = (event) => {
        remoteVideoRef.current.srcObject = event.streams[0];
      };

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("signal", { roomId: ROOM_ID, data: { candidate: event.candidate } });
        }
      };

      // Create an offer (only first participant does this)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", { roomId: ROOM_ID, data: { sdp: offer } });
    });

    return () => socket.disconnect();
  }, []);

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
