'use client'
import Header from "../components/header"

export default function Home(){
    return(
        <div className="h-full w-full">
           <Header/>
           <main className="h-[90vh] w-full flex items-center justify-center">
             <div className="h-[90%] w-[40%] bg-gray-400 rounded-xl flex items-center justify-center">
                 <h3 className="text-black">No Documents Created</h3>
              </div>     
           </main>
        </div>
    );
}