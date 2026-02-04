import { BookOpen, ExternalLink, ClipboardList, Stethoscope, Calculator, Info, ShieldCheck, FileText, Building2, Star, Heart, Brain, Pill } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIBCCState } from "@/contexts/IBCCContext";
import { useClinicalGuidelinesState } from "@/contexts/ClinicalGuidelinesContext";
import { SPECIALTY_MAP } from "@/types/clinicalGuidelines";

export const MobileReferencePanel = () => {
  const { allChapters, openPanel: openIBCCPanel, viewChapter } = useIBCCState();
  const {
    allGuidelines,
    openPanel: openGuidelinesPanel,
    viewGuideline,
    bookmarkedGuidelines,
    recentGuidelines,
    isBookmarked
  } = useClinicalGuidelinesState();

  const handleOpenChapter = (chapter: typeof allChapters[0]) => {
    viewChapter(chapter);
    openIBCCPanel();
  };

  const handleOpenGuideline = (guideline: typeof allGuidelines[0]) => {
    viewGuideline(guideline);
    openGuidelinesPanel();
  };

  const popularChapters = allChapters.slice(0, 6);

  // Get most relevant guidelines by specialty
  const popularGuidelines = [
    ...allGuidelines.filter(g => g.specialty === 'cardiology').slice(0, 2),
    ...allGuidelines.filter(g => g.specialty === 'pulmonology').slice(0, 2),
    ...allGuidelines.filter(g => g.specialty === 'critical-care').slice(0, 1),
    ...allGuidelines.filter(g => g.specialty === 'infectious-disease').slice(0, 1),
  ];

  const ibccHighlights = [
    {
      title: "Rapid bedside answers",
      description: "Concise summaries and differential diagnoses.",
      icon: <Stethoscope className="h-4 w-4 text-primary" />,
    },
    {
      title: "Protocols & checklists",
      description: "Stepwise workflows for high-stakes scenarios.",
      icon: <ClipboardList className="h-4 w-4 text-primary" />,
    },
    {
      title: "Point-of-care calculators",
      description: "Embedded scoring tools with interpretations.",
      icon: <Calculator className="h-4 w-4 text-primary" />,
    },
  ];

  const guidelinesHighlights = [
    {
      title: "Evidence-based recommendations",
      description: "Class I-III recommendations with level of evidence.",
      icon: <ShieldCheck className="h-4 w-4 text-warning" />,
    },
    {
      title: "Treatment algorithms",
      description: "Step-by-step protocols with medication dosing.",
      icon: <Pill className="h-4 w-4 text-warning" />,
    },
    {
      title: "Diagnostic criteria",
      description: "Standardized criteria for accurate diagnosis.",
      icon: <FileText className="h-4 w-4 text-warning" />,
    },
  ];

  const getSpecialtyIcon = (specialty: string) => {
    switch (specialty) {
      case 'cardiology': return <Heart className="h-4 w-4 text-destructive" />;
      case 'neurology': return <Brain className="h-4 w-4 text-primary" />;
      case 'pulmonology': return <span className="text-sm">🫁</span>;
      case 'critical-care': return <span className="text-sm">🏥</span>;
      case 'infectious-disease': return <span className="text-sm">🦠</span>;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Clinical Reference</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Access evidence-based guidelines and clinical protocols.
      </p>

      <Tabs defaultValue="guidelines" className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-4">
          <TabsTrigger value="guidelines" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Guidelines
          </TabsTrigger>
          <TabsTrigger value="ibcc" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            IBCC
          </TabsTrigger>
        </TabsList>

        {/* Clinical Guidelines Tab */}
        <TabsContent value="guidelines" className="space-y-4">
          {/* Bookmarked Guidelines */}
          {bookmarkedGuidelines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-warning fill-warning" />
                <h3 className="text-sm font-medium">Saved Guidelines</h3>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {bookmarkedGuidelines.slice(0, 4).map((guideline) => (
                  <Card
                    key={guideline.id}
                    className="p-3 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors flex-shrink-0 w-40"
                    onClick={() => handleOpenGuideline(guideline)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getSpecialtyIcon(guideline.specialty)}
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {guideline.organization.abbreviation}
                      </Badge>
                    </div>
                    <h4 className="text-xs font-medium line-clamp-2">{guideline.shortTitle}</h4>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Popular Guidelines Grid */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Popular Guidelines</h3>
            <div className="grid grid-cols-2 gap-3">
              {popularGuidelines.map((guideline) => {
                const specialtyInfo = SPECIALTY_MAP[guideline.specialty];
                return (
                  <Card
                    key={guideline.id}
                    className="p-3 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors"
                    onClick={() => handleOpenGuideline(guideline)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">{specialtyInfo?.icon || '📋'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-xs leading-tight line-clamp-2">
                          {guideline.shortTitle}
                        </h4>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {guideline.organization.abbreviation}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground">{guideline.year}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <Button variant="secondary" className="w-full" onClick={openGuidelinesPanel}>
            <FileText className="h-4 w-4 mr-2" />
            Browse All Guidelines
          </Button>

          {/* Guidelines Highlights */}
          <div className="pt-2 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Guidelines Features</h3>
            <div className="grid gap-2">
              {guidelinesHighlights.map((item) => (
                <Card key={item.title} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Source Organizations</h3>
            <div className="flex flex-wrap gap-1.5">
              {['AHA/ACC', 'ESC', 'ATS/IDSA', 'SCCM', 'ADA', 'KDIGO', 'GINA', 'GOLD'].map((org) => (
                <Badge key={org} variant="outline" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {org}
                </Badge>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* IBCC Tab */}
        <TabsContent value="ibcc" className="space-y-4">
          {/* Quick Access Chapters */}
          <div className="grid grid-cols-2 gap-3">
            {popularChapters.map((chapter) => (
              <Card
                key={chapter.id}
                className="p-3 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors"
                onClick={() => handleOpenChapter(chapter)}
              >
                <div className="flex items-start gap-2">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-xs leading-tight line-clamp-2">
                      {chapter.title}
                    </h4>
                    {chapter.category && (
                      <span className="text-[10px] text-muted-foreground">
                        {chapter.category.name}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Button variant="secondary" className="w-full" onClick={openIBCCPanel}>
            <BookOpen className="h-4 w-4 mr-2" />
            Browse All IBCC Chapters
          </Button>

          {/* IBCC Highlights */}
          <div className="pt-2 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">IBCC Features</h3>
            <div className="grid gap-2">
              {ibccHighlights.map((item) => (
                <Card key={item.title} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">About IBCC</h3>
            <p className="text-xs text-muted-foreground">
              The Internet Book of Critical Care by Dr. Josh Farkas - concise bedside reference for ICU care.
            </p>
            <Button variant="outline" className="w-full" size="sm" asChild>
              <a href="https://emcrit.org/ibcc/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Visit EMCrit IBCC
              </a>
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Usage Tips */}
      <div className="pt-4 border-t border-border space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Quick Tips</h3>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
            Use <kbd className="px-1 py-0.5 bg-secondary rounded text-[10px]">Ctrl+G</kbd> for guidelines, <kbd className="px-1 py-0.5 bg-secondary rounded text-[10px]">Ctrl+K</kbd> for IBCC.
          </li>
          <li className="flex items-start gap-2">
            <Star className="h-3.5 w-3.5 mt-0.5 text-warning flex-shrink-0" />
            Star frequently used guidelines for quick access.
          </li>
        </ul>
      </div>
    </div>
  );
};
