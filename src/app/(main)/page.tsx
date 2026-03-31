import { redirect } from "next/navigation";

export default function Home() {
  const hash = Math.random().toString(36).substring(2, 10);
  redirect(`/${hash}`);
}
