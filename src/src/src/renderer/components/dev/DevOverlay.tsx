import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useDevModeStore, type DevTab } from '@/stores/devMode'
import { DevToolsTab } from './DevToolsTab'
import { WorkersTab } from './WorkersTab'
import { SqlConsoleTab } from './SqlConsoleTab'
import { IpcInspectorTab } from './IpcInspectorTab'
import { StorybookTab } from './StorybookTab'
import { SystemCheckTab } from './SystemCheckTab'
import { LlmPlaygroundTab } from './LlmPlaygroundTab'
import { Wrench, Cpu, Database, Radio, Camera, ClipboardCheck, Sparkles } from 'lucide-react'

export function DevOverlay(): JSX.Element {
  const isOpen = useDevModeStore((s) => s.isOpen)
  const activeTab = useDevModeStore((s) => s.activeTab)
  const closeOverlay = useDevModeStore((s) => s.closeOverlay)
  const setActiveTab = useDevModeStore((s) => s.setActiveTab)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeOverlay()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]"
      >
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" /> Dev mode
          </SheetTitle>
          <SheetDescription className="text-xs">
            Internal tools. Press <kbd className="rounded bg-muted px-1 font-mono">Ctrl+Shift+D</kbd> to toggle.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as DevTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="px-5 pt-3">
            <TabsList className="grid h-8 w-full grid-cols-7">
              <TabsTrigger value="devtools" className="gap-1 text-[10px]">
                <Wrench className="h-3 w-3" />
                <span>Tools</span>
              </TabsTrigger>
              <TabsTrigger value="workers" className="gap-1 text-[10px]">
                <Cpu className="h-3 w-3" />
                <span>Workers</span>
              </TabsTrigger>
              <TabsTrigger value="sql" className="gap-1 text-[10px]">
                <Database className="h-3 w-3" />
                <span>SQL</span>
              </TabsTrigger>
              <TabsTrigger value="ipc" className="gap-1 text-[10px]">
                <Radio className="h-3 w-3" />
                <span>IPC</span>
              </TabsTrigger>
              <TabsTrigger value="storybook" className="gap-1 text-[10px]">
                <Camera className="h-3 w-3" />
                <span>Story</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="gap-1 text-[10px]">
                <ClipboardCheck className="h-3 w-3" />
                <span>System</span>
              </TabsTrigger>
              <TabsTrigger value="llm-playground" className="gap-1 text-[10px]">
                <Sparkles className="h-3 w-3" />
                <span>LLM</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <TabsContent value="devtools" className="mt-0">
              <DevToolsTab />
            </TabsContent>
            <TabsContent value="workers" className="mt-0">
              <WorkersTab />
            </TabsContent>
            <TabsContent value="sql" className="mt-0">
              <SqlConsoleTab />
            </TabsContent>
            <TabsContent value="ipc" className="mt-0">
              <IpcInspectorTab />
            </TabsContent>
            <TabsContent value="storybook" className="mt-0">
              <StorybookTab />
            </TabsContent>
            <TabsContent value="system" className="mt-0">
              <SystemCheckTab />
            </TabsContent>
            <TabsContent value="llm-playground" className="mt-0">
              <LlmPlaygroundTab />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
