export default function ProtectedPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Your recipes</h1>
      <p className="mt-2">Only signed-in users can see this page.</p>
    </section>
  );
}
