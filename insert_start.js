const fs = require('fs');
let app = fs.readFileSync('App.tsx', 'utf-8');

const startBlock = `
  if (!hasStarted) {
    return (
      <div className="min-h-[100dvh] w-full bg-zinc-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Graphic */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03]">
          <Brain size={600} />
        </div>

        <div className="z-10 text-center mb-10 mt-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
              <Zap size={24} className="text-white fill-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-900 font-mono">COSMIC GURU</h1>
          </div>
          <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase mb-2">Select Your Cognitive Protocol</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl z-10 relative">
          
          {/* CLASSIC MODE */}
          <button 
            onClick={() => handleStartSession("classic")}
            className="flex-1 bg-white border-2 border-zinc-200 hover:border-blue-500 rounded-3xl p-8 text-left transition-all hover:shadow-2xl hover:shadow-blue-500/10 group relative overflow-hidden focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          >
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
               <BookOpen size={120} className="text-blue-600" />
             </div>
             <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 border border-blue-100 group-hover:bg-blue-100 transition-colors">
               <GraduationCap size={28} className="text-blue-600" />
             </div>
             <h2 className="text-2xl font-black text-zinc-900 mb-3 tracking-tight">Classic Mode</h2>
             <p className="text-zinc-500 leading-relaxed mb-6 text-sm font-medium">
               Step-by-step guidance, whiteboard explanations, and detailed conceptual breakdowns. Perfect for learning new topics from the ground up.
             </p>
             <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase font-bold text-blue-700">
               <span className="bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">Explanations</span>
               <span className="bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">Step-by-step</span>
               <span className="bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">Foundational</span>
             </div>
          </button>

          {/* LOGIC MODE */}
          <button 
            onClick={() => handleStartSession("logic")}
            className="flex-1 bg-zinc-950 border-2 border-zinc-800 hover:border-indigo-500 rounded-3xl p-8 text-left transition-all hover:shadow-2xl hover:shadow-indigo-500/20 group relative overflow-hidden focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
          >
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
               <Brain size={120} className="text-amber-500" />
             </div>
             <div className="w-14 h-14 rounded-2xl bg-indigo-950/50 flex items-center justify-center mb-6 border border-indigo-500/30 group-hover:bg-indigo-900/50 transition-colors shadow-[0_0_15px_rgba(79,70,229,0.2)]">
               <Zap size={28} className="text-amber-400" />
             </div>
             <h2 className="text-2xl font-black text-white mb-3 tracking-tight uppercase font-mono">Logic Mode</h2>
             <p className="text-zinc-400 leading-relaxed mb-6 text-sm font-medium">
               0 Calculation. 100% Pure Logic. Focus on advanced, complex topics. Critical thinking triggers only. For building an Olympian genius mindset.
             </p>
             <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase font-bold text-amber-300">
               <span className="bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/20">Critical Thinking</span>
               <span className="bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/20">Zero Calc</span>
               <span className="bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/20">Genius Mindset</span>
             </div>
          </button>
        </div>

        {errorMsg && (
          <div className="mt-8 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-200">
            {errorMsg}
          </div>
        )}
      </div>
    );
  }
`;

app = app.replace('  if (isSleeping) {', startBlock + '\n  if (isSleeping) {');
fs.writeFileSync('App.tsx', app);
