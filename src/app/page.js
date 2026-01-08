import CitationGenerator from "@/components/CitationGenerator";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <main className="w-full max-w-5xl flex flex-col items-center gap-8">
        <CitationGenerator />
      </main>
    </div>
  );
}
