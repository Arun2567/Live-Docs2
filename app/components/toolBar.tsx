'use client';
import { useWebRTCContext } from "@/context/WebRTCContext";
import React, { useState,useEffect } from "react";
import { Editor } from "@tiptap/react";
import {FaCopy, FaAlignLeft, FaAlignCenter, FaAlignRight, FaAlignJustify, FaUser, FaShareAlt, FaSave, FaListOl, FaListUl, FaComments, FaTextHeight } from "react-icons/fa";
import Emailjs from "@emailjs/browser" 
interface ToolbarProps {
   editor: Editor | null;
}





const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  const [selectedLineHeight, setSelectedLineHeight] = useState("");
  const { roomId,activeUsers } = useWebRTCContext();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isAlertOpenEmail, setIsAlertOpenEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  useEffect(() => {
    Emailjs.init("SDfdxMyixsKo5XnSM");
  }, []);
  if (!editor) return null;
  
  const url = `https://d538-120-138-12-48.ngrok-free.app/Home/${roomId}`
  const documentLink = url;

  const handleLineHeightChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedLineHeight(value);
    if (value) {
      (editor.chain().focus() as any).setLineHeight(value).run();
    } else {
      (editor.chain().focus() as any).unsetLineHeight().run();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); 
      })
      .catch((err) => {
        console.error("Failed to copy URL:", err);
      });
  };
  const setFontFamily = (font: string) => {
    editor.chain().focus().setFontFamily(font).run();
  };


// 

// 

// SDfdxMyixsKo5XnSM
  const sendEmail=()=>{
    if (!recipientEmail) {
      alert("Please enter a recipient email!");
      return;
    }

    const templateParams = {
      document_link: documentLink,
      email: recipientEmail,
    };

    Emailjs.send("service_5wqi72i","template_wqjo7pk",templateParams)
    .then((response) => {
      console.log("Email sent successfully!", response.status, response.text);
      setRecipientEmail(""); 
      alert("Invitation sent successfully!");
    })
    .catch((error) => {
      console.error("Failed to send email:", error);
      alert("Failed to send invitation. Please try again.");
    });
  }
  return (
    <div className="h-[15vh] w-full bg-gray-400 flex flex-row justify-between">
      <div className="h-full w-2/4 grid grid-cols-2 gap-4">
        <div className="h-full w-full rounded-md flex justify-evenly items-center">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`cursor-pointer buttons-inactive ${editor.isActive("bold") ? "buttons-active" : ""}`}
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`cursor-pointer buttons-inactive ${editor.isActive("italic") ? "buttons-active" : ""}`}
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`cursor-pointer buttons-inactive ${editor.isActive("underline") ? "buttons-active" : ""}`}
          >
            U
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`cursor-pointer buttons-inactive ${editor.isActive("strike") ? "buttons-active" : ""}`}
          >
            S
          </button>
        </div>

        <div className="h-full w-full rounded-md flex justify-evenly items-center">
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`buttons-inactive ${editor.isActive("orderedList") ? "buttons-active" : ""}`}
          >
            <FaListOl className="text-black" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`buttons-inactive ${editor.isActive("bulletList") ? "buttons-active" : ""}`}
          >
            <FaListUl className="text-black" />
          </button>
          <div className="relative inline-block">
            <select
              id="line-height-select"
              value={selectedLineHeight}
              onChange={handleLineHeightChange}
              className="cursor-pointer py-2 border border-black rounded-md cursor-pointer text-black pr-5 pl-5"
            >
              <option value="">1</option>
              <option value="1.5">1.5</option>
              <option value="2">2</option>
              <option value="2.5">2.5</option>
              <option value="3">3</option>
            </select>
          </div>
          <button className="cursor-pointer w-[35%] h-[80%] bg-black rounded-md flex flex-row items-center justify-center">
            commands <FaComments size={15} className="text-white ml-2" />
          </button>
        </div>

        <div className="h-full w-full rounded-md flex justify-evenly items-center">
          <button
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={`cursor-pointer buttons-inactive ${editor.isActive("textAlign", { textAlign: "left" }) ? "buttons-active" : ""}`}
          >
            <FaAlignLeft className="text-black" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={`cursor-pointer buttons-inactive ${editor.isActive("textAlign", { textAlign: "center" }) ? "buttons-active" : ""}`}
          >
            <FaAlignCenter className="text-black" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={`cursor-pointer buttons-inactive ${editor.isActive("textAlign", { textAlign: "right" }) ? "buttons-active" : ""}`}
          >
            <FaAlignRight className="text-black" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            className={`cursor-pointer buttons-inactive ${editor.isActive("textAlign", { textAlign: "justify" }) ? "buttons-active" : ""}`}
          >
            <FaAlignJustify className="text-black" />
          </button>
        </div>

        <div className="h-full w-full rounded-md flex justify-evenly items-center">
        <button
            onClick={() => {
              console.log("Toggling H1");
              editor.chain().focus().toggleHeading({ level: 1 }).run();
            }}
            className={`buttons-inactive ${editor.isActive("heading", { level: 1 }) ? "buttons-active" : ""}`}
          >
            H1
          </button>
          <button
            onClick={() => {
              console.log("Toggling H2");
              editor.chain().focus().toggleHeading({ level: 2 }).run();
            }}
            className={`buttons-inactive ${editor.isActive("heading", { level: 2 }) ? "buttons-active" : ""}`}
          >
            H2
          </button>
          <button
            onClick={() => {
              console.log("Toggling H3");
              editor.chain().focus().toggleHeading({ level: 3 }).run();
            }}
            className={`buttons-inactive ${editor.isActive("heading", { level: 3 }) ? "buttons-active" : ""}`}
          >
            H3
          </button>
          <select
            id="font-select"
            className="cursor-pointer py-2 border border-black rounded-md cursor-pointer text-black pr-8"
            onChange={(e) => setFontFamily(e.target.value)}
          >
            <option value="Arial" style={{ fontFamily: "Arial" }}>Arial</option>
            <option value="'Times New Roman', serif" style={{ fontFamily: "'Times New Roman', serif" }}>
              Times New Roman
            </option>
            <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>
              Courier New
            </option>
            <option value="Georgia, serif" style={{ fontFamily: "Georgia, serif" }}>
              Georgia
            </option>
          </select>
        </div>
      </div>

      <div className="h-[100%] w-[25%]">
        <div className="h-[50%] w-full flex items-center justify-evenly">
          <div className="h-2/3 w-[60%] rounded-md flex justify-evenly items-center border border-2 border-black">
            <input
              type="text"
              placeholder="Untitled"
              className="h-10 w-7/8 flex justify-center items-center text-black ps-1 border-none outline-none"
            />
          </div>
          <button className="cursor-pointer w-[25%] h-2/3 bg-black rounded-md flex flex-row items-center justify-center">
            save <FaSave size={15} className="text-white ml-2" />
          </button>

        </div>
        <div className="h-[50%] w-full flex items-center justify-evenly">
        <div className="h-2/3 w-[60%] rounded-md flex justify-evenly items-center text-black">
            <h4>Active Users:{activeUsers}</h4>
            <div className="relative">
              <button 
                className="cursor-pointer bg-black p-2 rounded-full ml-5 relative z-10 flex items-center justigy-center"
                onClick={() => setIsAlertOpen(!isAlertOpen)}
              >
                <FaUser size={15} className="text-white m-1" />
              </button>
              {isAlertOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-md shadow-lg z-20 p-4">
                  <div className="text-black">
                    <h5 className="font-bold mb-2">User Information</h5>
                    <p>Active Users: {activeUsers}</p>
                    <p>Status: Online</p>
                    <button 
                      className="mt-2 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                      onClick={() => setIsAlertOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="relative w-[25%] h-2/3">
          <button  onClick={() => setIsAlertOpenEmail(!isAlertOpenEmail)} className="cursor-pointer w-full h-full bg-black rounded-md flex flex-row items-center justify-center">
            share <FaShareAlt size={15} className="text-white ml-2" />
          </button>
          {isAlertOpenEmail && (
                <div className="absolute right-0 top-full mt-2 w-100 h-40 bg-white rounded-md shadow-lg z-20 p-4 ">
                  <div className="text-black h-full flex flex-col justify-between">
                    <div className="w-full h-10 border border-1 border-black rounded flex items-center ">
                      <h6 className="w-[80%] h-full flex items-center truncate pl-2">
                      {url}
                      </h6>
                      <button onClick={handleCopy} title={copied ? "Copied!" : "Copy URL"} className="cursor-pointer w-[20%] h-full bg-black rounded flex flex-row items-center justify-center">
                         <FaCopy size={15} className="text-white ml-2" />
                         
                         {copied && <div className="absolute bg-black text-white rounded flex items-center justify-center">copied!</div>}
                      </button>
                    </div>
                     <div className="h-15 w-full flex items-center flex flex-row justify-between">
                       <input type="text" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}className="h-[75%] w-[75%]  border border-1 border-black rounded pl-2" placeholder="email" />
                       <button onClick={sendEmail} className="cursor-pointer w-[20%] h-[75%] bg-black rounded flex flex-row items-center justify-center text-white">send</button>
                     </div>
                  </div>

                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;