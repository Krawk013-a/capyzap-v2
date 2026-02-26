import { Settings, UserCircle, Moon, Sun, LogOut, Sparkles, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { BackupKeysDialog } from "./BackupKeysDialog";

interface SettingsMenuProps {
  onEditProfile: () => void;
  onOpenChangelog: () => void;
}

export function SettingsMenu({ onEditProfile, onOpenChangelog }: SettingsMenuProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const [showBackupDialog, setShowBackupDialog] = useState(false);

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full p-2 transition-colors hover:bg-accent" title="Configurações">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onEditProfile} className="cursor-pointer gap-2">
            <UserCircle className="h-4 w-4" />
            Editar perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowBackupDialog(true)} className="cursor-pointer gap-2">
            <ShieldCheck className="h-4 w-4" />
            Backup de Segurança
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer gap-2">
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenChangelog} className="cursor-pointer gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Novidades
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BackupKeysDialog
        open={showBackupDialog}
        onClose={() => setShowBackupDialog(false)}
      />
    </>
  );
}
