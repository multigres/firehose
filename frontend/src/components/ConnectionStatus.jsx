export function ConnectionStatus({ isConnected }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-sm text-slate-400">
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}
