import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SIGNAL_SERVER = "https://callapp-apl7.onrender.com"; // change later to your Render URL if deployed

function App() {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const roomRef = useRef("default-room");

  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    // connect to signaling server
    socketRef.current = io(SIGNAL_SERVER);

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server");
    });

    socketRef.current.on("signal", async ({ from, data }) => {
      if (!pcRef.current) await createPeerConnection();

      if (data.type === "offer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socketRef.current.emit("signal", { roomId: roomRef.current, data: pcRef.current.localDescription });
      } else if (data.type === "answer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        try {
          await pcRef.current.addIceCandidate(data);
        } catch (e) {
          console.warn("Error adding ICE candidate", e);
        }
      }
    });

    socketRef.current.on("peer-joined", async () => {
      console.log("Peer joined, sending offer...");
      if (!pcRef.current) await createPeerConnection();

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socketRef.current.emit("signal", { roomId: roomRef.current, data: pcRef.current.localDescription });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  async function createPeerConnection() {
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("signal", { roomId: roomRef.current, data: event.candidate });
      }
    };

    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));
  }

  const joinRoom = async () => {
    if (!socketRef.current) return;
    socketRef.current.emit("join", roomRef.current);
    setJoined(true);
    if (!pcRef.current) await createPeerConnection();
  };

  const leaveRoom = () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track && s.track.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    setJoined(false);
  };

  const toggleMute = () => {
    const stream = localVideoRef.current?.srcObject;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted(!muted);
  };

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>Simple WebRTC Call</h2>

      <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
        <div>
          <p>Local Video</p>
          <video ref={localVideoRef} autoPlay playsInline muted width="300" style={{ background: "#000" }} />
        </div>
        <div>
          <p>Remote Video</p>
          <video ref={remoteVideoRef} autoPlay playsInline width="300" style={{ background: "#000" }} />
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        {!joined ? (
          <button onClick={joinRoom} style={{ marginRight: "10px" }}>
            Join
          </button>
        ) : (
          <button onClick={leaveRoom} style={{ marginRight: "10px" }}>
            Leave
          </button>
        )}
        <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
      </div>

      <p style={{ marginTop: "10px", color: "#555" }}>
        Room: <code>{roomRef.current}</code>
      </p>
    </div>
  );
}

export default App;
