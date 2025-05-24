import { auth } from "@/auth";
import { AcceptInviteForm } from "@/components/invite/accept-invite-form";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

interface InvitePageProps {
  searchParams: Promise<{
    token: string;
  }>;
}

export default async function InvitePage({
  searchParams,
}: InvitePageProps) {
  const [session, { token }] = await Promise.all([
    auth(),
    searchParams
  ]);

  if (!token) {
    redirect("/");
  }

  const invite = await prisma.invite.findUnique({
    where: { id: token },
    include: {
      organization: true,
    },
  });

  if (!invite) {
    redirect("/");
  }

  if (invite.status !== "PENDING") {
    redirect("/");
  }

  if (invite.expires_at < new Date()) {
    await prisma.invite.update({
      where: { id: token },
      data: { status: "EXPIRED" },
    });
    redirect("/");
  }

  
  if (!session?.user) {
    redirect(`/login?callbackUrl=/invite?token=${token}`);
  }

  
  if (invite.email !== session.user.email) {
    redirect(`/invite/switch-account?token=${token}&email=${invite.email}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          Aceitar Convite
        </h1>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
          Você foi convidado para participar da organização{" "}
          <strong>{invite.organization.name}</strong>
        </p>
            <p className="text-sm text-gray-500">
              Você está conectado como <strong>{session.user.email}</strong>
            </p>
          </div>

        <AcceptInviteForm inviteId={invite.id} />
        </div>
      </div>
    </div>
  );
} 