export default function Loading() {
    return (
        <div className="min-h-screen bg-[#050505] text-foreground flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 animate-pulse flex items-center justify-center">
                    <div className="w-6 h-6 bg-blue-500 rounded-full animate-bounce" />
                </div>
                <div className="text-white/40 text-sm font-medium animate-pulse">Loading TaskFlow...</div>
            </div>
        </div>
    );
}
