"use client";
import { useRouter } from "next/navigation";


export default function Root() {
  const router = useRouter();

  return (
    <div className="w-full h-[100vh] flex items-center justify-center">
      <button onClick={()=>router.push(`/Home`)} className="h-15 w-25 bg-gray-400 text-black rounded-md">Home</button>
    </div>
  );
} 
