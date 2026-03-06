import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Terminal, Server, Globe, Package, Zap, HardDrive } from 'lucide-react';

export default function Installation() {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin" className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-zinc-600" />
          </Link>
          <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">
            Installation <span className="text-zinc-300 font-light">/</span> Local Server
          </h1>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <section className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" /> Offline Environment
            </h2>
            <p className="text-zinc-600 leading-relaxed">
              This application is designed to run on a local network without internet access. 
              To install it on a dedicated server (like a Raspberry Pi, a Windows PC, or a Linux server), 
              follow these steps carefully.
            </p>
          </section>

          {/* Prerequisites */}
          <section className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" /> Prerequisites
            </h2>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="mt-1 p-1 bg-zinc-100 rounded-lg"><Zap className="w-4 h-4 text-zinc-600" /></div>
                <div>
                  <span className="font-bold text-zinc-800">Node.js (v18 or higher):</span>
                  <p className="text-sm text-zinc-500">The runtime environment for the server.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="mt-1 p-1 bg-zinc-100 rounded-lg"><Zap className="w-4 h-4 text-zinc-600" /></div>
                <div>
                  <span className="font-bold text-zinc-800">NPM or Yarn:</span>
                  <p className="text-sm text-zinc-500">Package managers to install dependencies.</p>
                </div>
              </li>
            </ul>
          </section>

          {/* Step by Step */}
          <section className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" /> Step-by-Step Guide
            </h2>
            
            <div className="space-y-10">
              {/* Step 1 */}
              <div className="relative pl-8 border-l-2 border-zinc-100">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm"></div>
                <h3 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">Step 1: Prepare the code</h3>
                <p className="text-zinc-600 text-sm mb-4">
                  Download the project files to a computer that <span className="font-bold text-indigo-600">has internet access</span> first.
                </p>
                <div className="bg-zinc-900 rounded-xl p-4 font-mono text-xs text-zinc-400">
                  # Clone the repository (if applicable)<br/>
                  git clone https://github.com/your-repo/kiosk-app.git<br/>
                  cd kiosk-app
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative pl-8 border-l-2 border-zinc-100">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm"></div>
                <h3 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">Step 2: Install Dependencies</h3>
                <p className="text-zinc-600 text-sm mb-4">
                  Run this while connected to the internet to download all required libraries.
                </p>
                <div className="bg-zinc-900 rounded-xl p-4 font-mono text-xs text-zinc-400">
                  npm install
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative pl-8 border-l-2 border-zinc-100">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm"></div>
                <h3 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">Step 3: Build for Production</h3>
                <p className="text-zinc-600 text-sm mb-4">
                  Compile the frontend into static files.
                </p>
                <div className="bg-zinc-900 rounded-xl p-4 font-mono text-xs text-zinc-400">
                  npm run build
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative pl-8 border-l-2 border-zinc-100">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm"></div>
                <h3 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">Step 4: Transfer to Local Server</h3>
                <p className="text-zinc-600 text-sm mb-4">
                  Copy the entire folder (including <code className="bg-zinc-100 px-1 rounded text-indigo-600">node_modules</code> and <code className="bg-zinc-100 px-1 rounded text-indigo-600">dist</code>) 
                  to your offline server using a USB drive.
                </p>
              </div>

              {/* Step 5 */}
              <div className="relative pl-8 border-l-2 border-zinc-100">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm"></div>
                <h3 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">Step 5: Start the Server</h3>
                <p className="text-zinc-600 text-sm mb-4">
                  On the local server, run the start command.
                </p>
                <div className="bg-zinc-900 rounded-xl p-4 font-mono text-xs text-zinc-400">
                  # Set production mode<br/>
                  export NODE_ENV=production<br/>
                  # Start the server<br/>
                  npm start
                </div>
              </div>
            </div>
          </section>

          {/* Accessing the app */}
          <section className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Server className="w-5 h-5" /> Accessing the App
            </h2>
            <p className="text-indigo-100 text-sm leading-relaxed mb-6">
              Once the server is running, find the local IP address of the server (e.g., 192.168.1.50). 
              Any device on the same network can access the app by typing the IP in their browser:
            </p>
            <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Admin Dashboard</span>
                  <code className="font-mono text-lg font-bold">http://[SERVER_IP]:3000/admin</code>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Kiosk Player</span>
                  <code className="font-mono text-lg font-bold">http://[SERVER_IP]:3000/player?screenId=...</code>
                </div>
              </div>
            </div>
          </section>

          {/* Database & Storage */}
          <section className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-600" /> Data Persistence
            </h2>
            <p className="text-zinc-600 text-sm leading-relaxed">
              The application uses <span className="font-bold text-zinc-800">SQLite</span> for the database 
              (stored in <code className="bg-zinc-100 px-1 rounded">playlist.db</code>) and stores uploaded files 
              in the <code className="bg-zinc-100 px-1 rounded">/uploads</code> folder. 
              Make sure the user running the server has write permissions for these files.
            </p>
          </section>
        </div>

        <div className="mt-12 text-center text-zinc-400 text-xs uppercase tracking-widest font-bold">
          Lalo's Kiosk App • Offline Deployment Guide
        </div>
      </div>
    </div>
  );
}
