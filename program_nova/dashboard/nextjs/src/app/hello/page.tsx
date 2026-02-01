import Link from 'next/link';

export default function HelloPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">
          Hello World!
        </h1>
        <p className="text-xl text-blue-100 mb-8">
          Welcome to your Nova Dashboard
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-white text-indigo-700 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
