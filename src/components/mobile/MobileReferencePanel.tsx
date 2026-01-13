import { BookOpen, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIBCCState } from "@/contexts/IBCCContext";

export const MobileReferencePanel = () => {
  const { allChapters, openPanel, viewChapter } = useIBCCState();

  const handleOpenChapter = (chapter: typeof allChapters[0]) => {
    viewChapter(chapter);
    openPanel();
  };

  const popularChapters = allChapters.slice(0, 8);

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Clinical Reference</h2>
        <Button variant="ghost" size="sm" onClick={openPanel}>
          <ExternalLink className="h-4 w-4 mr-1" />
          Open Full
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Quick access to IBCC clinical guidelines and protocols.
      </p>

      {/* Quick Access Chapters */}
      <div className="grid grid-cols-2 gap-3">
        {popularChapters.map((chapter) => (
          <Card
            key={chapter.id}
            className="p-4 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors"
            onClick={() => handleOpenChapter(chapter)}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-sm leading-tight truncate">
                  {chapter.title}
                </h3>
                {chapter.category && (
                  <span className="text-xs text-muted-foreground">
                    {chapter.category.name}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-4 border-t border-border">
        <Button variant="secondary" className="w-full" onClick={openPanel}>
          <BookOpen className="h-4 w-4 mr-2" />
          Browse All Chapters
        </Button>
      </div>

      <div className="pt-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">About IBCC</h3>
        <p className="text-sm text-muted-foreground">
          The Internet Book of Critical Care (IBCC) is an online critical care reference 
          by Dr. Josh Farkas. Content is embedded for quick reference during rounds.
        </p>
      </div>
    </div>
  );
};
