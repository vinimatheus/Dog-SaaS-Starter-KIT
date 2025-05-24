import { Github, Mail } from "lucide-react";

interface ProviderIconsProps {
	provider: string;
}

export function ProviderIcons({ provider }: ProviderIconsProps) {
	switch (provider) {
		case "github":
			return <Github className="h-5 w-5" />;
		case "google":
			return <Mail className="h-5 w-5" />;
		default:
			return null;
	}
} 