import ChatWorkspace from "@/components/features/workspace/ChatWorkspace";

export default async function SessionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  
  // Here, a real backend would fetch initialData from MongoDB/Supabase.
  // For now, we just pass the ID down cleanly.
  
  return (
    <ChatWorkspace sessionId={id} />
  );
}
