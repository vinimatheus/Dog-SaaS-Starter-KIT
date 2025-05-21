import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateOrganizationButton() {
	const router = useRouter();

	return (
		<Button
			onClick={() => router.push("/organizations/new")}
			className="flex items-center gap-2"
		>
			<Plus className="h-4 w-4" />
			Nova Organização
		</Button>
	);
} 