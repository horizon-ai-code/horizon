import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-jb-bg text-jb-text p-8">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-jb-text-muted text-lg mb-8">Page not found</p>
      <Link
        href="/"
        className="px-6 py-2 rounded-xl bg-jb-accent text-white font-semibold hover:opacity-90 transition-opacity"
      >
        Return Home
      </Link>
    </div>
  );
}
