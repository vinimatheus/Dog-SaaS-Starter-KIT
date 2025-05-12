import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { BackButton } from "@/components/back-button";

interface SwitchAccountPageProps {
  searchParams: Promise<{
    token: string;
    email: string;
  }>;
}

export default async function SwitchAccountPage({
  searchParams,
}: SwitchAccountPageProps) {
  const [session, { token, email }] = await Promise.all([
    auth(),
    searchParams
  ]);

  if (!token || !email) {
    redirect("/");
  }

  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=/invite?token=${token}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          Trocar de Conta
        </h1>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Você está conectado como <strong>{session.user.email}</strong>
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <p className="text-yellow-800 text-sm">
                O convite foi enviado para <strong>{email}</strong>.
                Para aceitar o convite, você precisa estar conectado com este email.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <SignOutButton
              callbackUrl={`/invite?token=${token}`}
              className="w-full"
            >
              Desconectar e usar outro email
            </SignOutButton>
            <BackButton className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
} 