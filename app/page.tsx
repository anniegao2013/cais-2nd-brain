import TaskList from "./task-list";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Second Brain
          </span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <TaskList />
      </main>
    </div>
  );
}
