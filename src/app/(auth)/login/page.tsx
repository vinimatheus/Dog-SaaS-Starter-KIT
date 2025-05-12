import { LoginButton } from "@/components/LoginButton";

export default async function Home() {

  return (
    <div className="w-full h-full flex justify-center items-center flex-col gap-y-4">
      <LoginButton />
    </div>
  );
}
