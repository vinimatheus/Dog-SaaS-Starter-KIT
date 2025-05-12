import { auth } from "@/auth";
import { LoginButton } from "@/components/LoginButton";
import { redirect } from "next/navigation";

export default async function Home() {
	const session = await auth();


  if (session?.user?.id) {
		redirect("/organizations");
  }
  return (
    <div className="w-full h-full flex justify-center items-center flex-col gap-y-4">
      <LoginButton />
    </div>
  );
}
