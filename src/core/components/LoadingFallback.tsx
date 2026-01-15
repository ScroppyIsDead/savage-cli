const LoadingFallback = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 text-white">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-solid border-white/30 border-t-white" />
        <p className="text-base font-semibold tracking-wide text-slate-100">
          Loading resources…
        </p>
        <p className="text-xs text-slate-400">
          Hang tight while the dashboard wakes up.
        </p>
      </div>
    </div>
  );
};

export default LoadingFallback;
