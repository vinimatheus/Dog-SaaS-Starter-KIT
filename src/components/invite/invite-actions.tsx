"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { InviteStatus } from "@prisma/client";
import { resendInviteAction, deleteInviteAction } from "@/actions/invite-member.actions";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

interface InviteActionsProps {
	inviteId: string;
	status: InviteStatus;
	expiresAt: Date;
}

export function InviteActions({ inviteId, status, expiresAt }: InviteActionsProps) {
	const [isPending, startTransition] = useTransition();
	const [isDeleting, setIsDeleting] = useState(false);

	const isExpired = useMemo(() => {
		return new Date(expiresAt) < new Date();
	}, [expiresAt]);
	const canResend = status === "PENDING" && !isExpired;
	const canDelete = status === "PENDING" || status === "EXPIRED";

	const handleResend = () => {
		startTransition(async () => {
			try {
				const result = await resendInviteAction(inviteId);
				if (result.success) {
					toast.success("Convite reenviado com sucesso!");
				} else {
					toast.error(result.error || "Erro ao reenviar convite");
				}
			} catch (error) {
				toast.error("Erro ao reenviar convite" + error);
			}
		});
	};

	const handleDelete = () => {
		if (!confirm("Tem certeza que deseja excluir este convite?")) {
			return;
		}

		setIsDeleting(true);
		startTransition(async () => {
			try {
				const result = await deleteInviteAction(inviteId);
				if (result.success) {
					toast.success("Convite excluído com sucesso!");
				} else {
					toast.error(result.error || "Erro ao excluir convite");
				}
			} catch (error) {
				toast.error("Erro ao excluir convite" + error);
			} finally {
				setIsDeleting(false);
			}
		});
	};

	return (
		<div className="flex items-center gap-2">
			{canResend && (
				<Button
					variant="outline"
					size="sm"
					onClick={handleResend}
					disabled={isPending}
					className="h-8 px-2"
				>
					{isPending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<RefreshCw className="h-4 w-4" />
					)}
					<span className="sr-only">Reenviar convite</span>
				</Button>
			)}
			{canDelete && (
				<Button
					variant="destructive"
					size="sm"
					onClick={handleDelete}
					disabled={isPending || isDeleting}
					className="h-8 px-2"
				>
					{isDeleting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Trash2 className="h-4 w-4" />
					)}
					<span className="sr-only">Excluir convite</span>
				</Button>
			)}
		</div>
	);
} 