import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CHANGELOG_HISTORY } from "./ChangelogBanner";
import { Sparkles, History } from "lucide-react";

interface ChangelogDialogProps {
    open: boolean;
    onClose: () => void;
}

export function ChangelogDialog({ open, onClose }: ChangelogDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <DialogTitle>Histórico de Atualizações</DialogTitle>
                    </div>
                    <DialogDescription>
                        Acompanhe a evolução do CapyZap e novas funcionalidades.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6 pt-4">
                    <div className="space-y-8">
                        {CHANGELOG_HISTORY.map((version, idx) => (
                            <div key={version.version} className="relative pl-6 border-l border-primary/20 last:border-0 pb-2">
                                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="text-xs font-mono text-muted-foreground">{version.date}</span>
                                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                        v{version.version}
                                    </span>
                                </div>
                                <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                                    {idx === 0 && <Sparkles className="h-3 w-3 text-yellow-500" />}
                                    {version.title}
                                </h3>
                                <ul className="space-y-1.5">
                                    {version.items.map((item, i) => (
                                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                            <span className="text-primary mt-1">•</span>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
