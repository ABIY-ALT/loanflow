
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, PlusCircle, Trash2, AlertTriangle, Save, Clock, GripVertical } from 'lucide-react';
import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkflowStage {
  id: string;
  name: string;
  defaultTimelineDays: number; 
}

const initialStages: WorkflowStage[] = [
  { id: 'application', name: 'Application Submitted', defaultTimelineDays: 2 },
  { id: 'doc_collection', name: 'Document Collection', defaultTimelineDays: 7 },
  { id: 'review', name: 'Under Review', defaultTimelineDays: 5 },
  { id: 'approval', name: 'Approval Process', defaultTimelineDays: 3 },
  { id: 'disbursement', name: 'Funds Disbursed', defaultTimelineDays: 1 },
];

interface DraggableAccordionItemProps {
  stage: WorkflowStage;
  handleStageChange: (id: string, field: keyof WorkflowStage, value: string | number) => void;
  handleRemoveStage: (id: string) => void;
}

const DraggableAccordionItem = ({ stage, handleStageChange, handleRemoveStage }: DraggableAccordionItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.8 : 1,
    position: 'relative' as 'relative',
  };

  return (
    <AccordionItem 
      value={stage.id} 
      key={stage.id} 
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-md mb-2 shadow-sm"
    >
      <AccordionTrigger 
        className="hover:no-underline w-full data-[state=open]:border-b"
        {...attributes} 
        {...listeners} 
      >
        <div className="flex items-center justify-between w-full pr-4 py-2">
          <div className="flex items-center">
            <GripVertical className="h-5 w-5 text-muted-foreground mr-3 cursor-grab" />
            <span>{stage.name}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {stage.defaultTimelineDays} days
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 p-4 bg-background rounded-b-md">
        <div>
          <Label htmlFor={`stage-name-${stage.id}`}>Stage Name</Label>
          <Input
            id={`stage-name-${stage.id}`}
            value={stage.name}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => handleStageChange(stage.id, 'name', e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`stage-timeline-${stage.id}`}>Default Timeline (days)</Label>
          <Input
            id={`stage-timeline-${stage.id}`}
            type="number"
            value={stage.defaultTimelineDays}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => handleStageChange(stage.id, 'defaultTimelineDays', parseInt(e.target.value,10) || 0)}
            className="mt-1"
            min="1"
          />
        </div>
        <Button variant="destructive" size="sm" onClick={() => handleRemoveStage(stage.id)}>
          <Trash2 className="mr-2 h-4 w-4" /> Remove Stage
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
};


export default function SettingsPage() {
  const { toast } = useToast();
  const [stages, setStages] = useState<WorkflowStage[]>(initialStages);
  const [newStageName, setNewStageName] = useState('');
  const [newStageTimeline, setNewStageTimeline] = useState(3);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [overdueThreshold, setOverdueThreshold] = useState(2); 

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStages((currentStages) => {
        const oldIndex = currentStages.findIndex((stage) => stage.id === active.id);
        const newIndex = currentStages.findIndex((stage) => stage.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return currentStages;
        return arrayMove(currentStages, oldIndex, newIndex);
      });
    }
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) {
      toast({ title: "Error", description: "Stage name cannot be empty.", variant: "destructive" });
      return;
    }
    setStages([
      ...stages,
      { id: Date.now().toString(), name: newStageName, defaultTimelineDays: newStageTimeline }
    ]);
    setNewStageName('');
    setNewStageTimeline(3);
    toast({ title: "Success", description: "New workflow stage added." });
  };

  const handleRemoveStage = (id: string) => {
    setStages(stages.filter(stage => stage.id !== id));
    toast({ title: "Success", description: "Workflow stage removed." });
  };

  const handleStageChange = (id: string, field: keyof WorkflowStage, value: string | number) => {
    setStages(stages.map(stage => stage.id === id ? { ...stage, [field]: field === 'defaultTimelineDays' ? Number(value) : value } : stage));
  };
  
  const handleSaveChanges = () => {
    console.log("Settings saved:", { stages, enableNotifications, overdueThreshold });
    toast({
      title: "Settings Saved",
      description: "Your workflow and notification settings have been updated.",
      action: <Check className="h-5 w-5 text-green-500" />,
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure loan workflows, timelines, and notification preferences.
        </p>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <Card>
          <CardHeader>
            <CardTitle>Workflow Configuration</CardTitle>
            <CardDescription>Define and reorder the stages and default timelines for loan processing. Drag to reorder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SortableContext
              items={stages.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <Accordion type="single" collapsible className="w-full">
                {stages.map((stage) => (
                  <DraggableAccordionItem
                    key={stage.id}
                    stage={stage}
                    handleStageChange={handleStageChange}
                    handleRemoveStage={handleRemoveStage}
                  />
                ))}
              </Accordion>
            </SortableContext>

            <Separator />
            
            <div className="space-y-2 p-4 border rounded-lg bg-muted/20">
              <h4 className="font-medium">Add New Stage</h4>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-grow">
                  <Label htmlFor="new-stage-name">Stage Name</Label>
                  <Input 
                    id="new-stage-name" 
                    value={newStageName} 
                    onChange={(e) => setNewStageName(e.target.value)} 
                    placeholder="e.g., Final Verification"
                    className="mt-1" 
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <Label htmlFor="new-stage-timeline">Timeline (days)</Label>
                  <Input 
                    id="new-stage-timeline" 
                    type="number" 
                    value={newStageTimeline} 
                    onChange={(e) => setNewStageTimeline(parseInt(e.target.value, 10))} 
                    className="mt-1"
                    min="1"
                  />
                </div>
                <Button onClick={handleAddStage} className="w-full sm:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Stage
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </DndContext>

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Manage how and when notifications are sent for overdue tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="enable-notifications" className="font-medium">Enable Overdue Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive alerts for loan processes exceeding their timeline.</p>
            </div>
            <Switch
              id="enable-notifications"
              checked={enableNotifications}
              onCheckedChange={setEnableNotifications}
              aria-label="Enable overdue notifications"
            />
          </div>
          
          {enableNotifications && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/20">
              <Label htmlFor="overdue-threshold">Notify if overdue by (days)</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <Input
                  id="overdue-threshold"
                  type="number"
                  value={overdueThreshold}
                  onChange={(e) => setOverdueThreshold(parseInt(e.target.value, 10))}
                  className="max-w-xs"
                  min="1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Notifications will be triggered if a loan stage is {overdueThreshold} or more days past its deadline.
              </p>
            </div>
          )}
          <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 rounded-r-md">
             <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                    <h5 className="font-semibold text-yellow-700 dark:text-yellow-300">System Note</h5>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Actual notification delivery (e.g., email, SMS) needs backend integration. This interface configures the triggers.
                    </p>
                </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button onClick={handleSaveChanges} size="lg">
          <Save className="mr-2 h-4 w-4" /> Save All Settings
        </Button>
      </div>
    </div>
  );
}
