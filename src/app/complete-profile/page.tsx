import { auth } from "@/auth";
import { CompleteProfileForm } from "@/components/complete-profile-form";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { Dog } from "lucide-react";

export const metadata: Metadata = {
  title: "Complete seu perfil | Dog Inc."
};

interface PageProps {
  params: Promise<Record<string, never>>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function CompleteProfilePage({
  searchParams
}: PageProps) {
  const session = await auth();
  const params = await searchParams;

  
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.name) {
    redirect("/organizations");
  }

  
  const returnTo = params.returnTo || "/organizations";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <a
            href="#"
            className="flex flex-col items-center gap-2 font-medium"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md">
              <Dog className="size-6" />
            </div>
            <span className="sr-only">Dog Inc.</span>
          </a>
          <h1 className="text-xl font-bold">Complete seu perfil</h1>
          <p className="text-center text-sm text-muted-foreground">
            Precisamos de algumas informações adicionais para personalizar sua experiência
          </p>
        </div>

        <CompleteProfileForm returnTo={returnTo} email={session.user.email} />
      </div>
    </div>
  );
} 