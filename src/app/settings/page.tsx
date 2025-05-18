
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, PlusCircle, Trash2, AlertTriangle, Save, Clock, GripVertical, FileText } from 'lucide-react';
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
import type { LoanStage } from '@/types/loan'; // Import LoanStage enum

interface RequiredDocumentConfig {
  id: string;
  name: string;
}

// Renamed from WorkflowStage to StageConfig to avoid confusion with LoanStage enum
export interface StageConfig {
  id: string; // Should correspond to keys that can map to LoanStage enum values e.g. 'application_submitted'
  name: string; // User-friendly name, e.g., "Application Submitted"
  loanStageEnum: LoanStage; // Store the corresponding enum value
  defaultTimelineDays: number;
  requiredDocuments: RequiredDocumentConfig[];
}

// This is exported so loan detail page can "access" it for prototype
export const initialStageConfigs: StageConfig[] = [
  { id: 'application_submitted', name: 'Application Submitted', loanStageEnum: LoanStage.APPLICATION_SUBMITTED, defaultTimelineDays: 2, requiredDocuments: [{id: 'doc_id_card', name: 'Identification Card'}] },
  { id: 'document_collection', name: 'Document Collection', loanStageEnum: LoanStage.DOCUMENT_COLLECTION, defaultTimelineDays: 7, requiredDocuments: [{id: 'doc_proof_income', name: 'Proof of Income'}, {id: 'doc_bank_statement', name: 'Bank Statement'}] },
  { id: 'under_review', name: 'Under Review', loanStageEnum: LoanStage.UNDER_REVIEW, defaultTimelineDays: 5, requiredDocuments: [] },
  { id: 'additional_info_required', name: 'Additional Info Required', loanStageEnum: LoanStage.ADDITIONAL_INFO_REQUIRED, defaultTimelineDays: 3, requiredDocuments: [] },
  { id: 'approved', name: 'Approved', loanStageEnum: LoanStage.APPROVED, defaultTimelineDays: 3, requiredDocuments: [{id: 'doc_loan_agreement', name: 'Signed Loan Agreement'}] },
  { id: 'rejected', name: 'Rejected', loanStageEnum: LoanStage.REJECTED, defaultTimelineDays: 1, requiredDocuments: [] },
  { id: 'funds_disbursed', name: 'Funds Disbursed', loanStageEnum: LoanStage.FUNDS_DISBURSED, defaultTimelineDays: 1, requiredDocuments: [] },
];


interface DraggableAccordionItemProps {
  stageConfig: StageConfig;
  handleStageConfigChange: (id: string, field: keyof StageConfig, value: any) => void;
  handleRemoveStageConfig: (id: string) => void;
  handleAddRequiredDocument: (stageId: string, docName: string) => void;
  handleRemoveRequiredDocument: (stageId: string, docId: string) => void;
  handleRequiredDocumentNameChange: (stageId: string, docId: string, newName: string) => void;
}

const DraggableAccordionItem = ({ 
  stageConfig, 
  handleStageConfigChange, 
  handleRemoveStageConfig,
  handleAddRequiredDocument,
  handleRemoveRequiredDocument,
  handleRequiredDocumentNameChange,
}: DraggableAccordionItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stageConfig.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.8 : 1,
    position: 'relative' as 'relative',
  };

  const [newReqDocName, setNewReqDocName] = useState('');

  const onAddReqDoc = () => {
    if (newReqDocName.trim()) {
      handleAddRequiredDocument(stageConfig.id, newReqDocName.trim());
      setNewReqDocName('');
    }
  };

  return (
    <AccordionItem
      value={stageConfig.id}
      key={stageConfig.id}
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-md mb-2 shadow-sm"
    >
      <AccordionTrigger
        className="hover:no-underline w-full data-[state=open]:border-b"
      >
        <div className="flex items-center justify-between w-full pr-4 py-2">
          <div className="flex items-center" {...attributes} {...listeners} > {/* Moved dnd listeners here */}
            <GripVertical className="h-5 w-5 text-muted-foreground mr-3 cursor-grab" />
            <span>{stageConfig.name}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {stageConfig.defaultTimelineDays} days, {stageConfig.requiredDocuments.length} doc(s)
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 p-4 bg-background rounded-b-md">
        <div>
          <Label htmlFor={`stage-name-${stageConfig.id}`}>Stage Name</Label>
          <Input
            id={`stage-name-${stageConfig.id}`}
            value={stageConfig.name}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => handleStageConfigChange(stageConfig.id, 'name', e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`stage-timeline-${stageConfig.id}`}>Default Timeline (days)</Label>
          <Input
            id={`stage-timeline-${stageConfig.id}`}
            type="number"
            value={stageConfig.defaultTimelineDays}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => handleStageConfigChange(stageConfig.id, 'defaultTimelineDays', parseInt(e.target.value,10) || 0)}
            className="mt-1"
            min="1"
          />
        </div>
        
        <Separator />
        <div>
          <h5 className="text-md font-medium mb-2">Required Documents for this Stage</h5>
          {stageConfig.requiredDocuments.length === 0 && (
            <p className="text-sm text-muted-foreground">No specific documents required for this stage.</p>
          )}
          <ul className="space-y-2">
            {stageConfig.requiredDocuments.map(doc => (
              <li key={doc.id} className="flex items-center gap-2 p-2 border rounded-md">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Input 
                  value={doc.name}
                  onChange={(e) => handleRequiredDocumentNameChange(stageConfig.id, doc.id, e.target.value)}
                  className="flex-grow text-sm"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <Button variant="ghost" size="icon" onClick={() => handleRemoveRequiredDocument(stageConfig.id, doc.id)} aria-label="Remove document requirement">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-2 mt-4">
            <div className="flex-grow">
              <Label htmlFor={`new-req-doc-${stageConfig.id}`}>New Document Name</Label>
              <Input 
                id={`new-req-doc-${stageConfig.id}`}
                value={newReqDocName}
                onChange={(e) => setNewReqDocName(e.target.value)}
                placeholder="e.g., Passport"
                className="mt-1"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </div>
            <Button onClick={onAddReqDoc} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Document
            </Button>
          </div>
        </div>

        <Button variant="destructive" size="sm" onClick={() => handleRemoveStageConfig(stageConfig.id)} className="mt-4">
          <Trash2 className="mr-2 h-4 w-4" /> Remove Stage
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
};


export default function SettingsPage() {
  const { toast } = useToast();
  const [stageConfigs, setStageConfigs] = useState<StageConfig[]>(initialStageConfigs); // Renamed from stages
  const [newStageName, setNewStageName] = useState('');
  const [newStageTimeline, setNewStageTimeline] = useState(3);
  // Find a default LoanStage enum value for new stages, e.g. APPLICATION_SUBMITTED or allow selection
  const [newStageEnum, setNewStageEnum] = useState<LoanStage>(LoanStage.APPLICATION_SUBMITTED);


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
      setStageConfigs((currentConfigs) => {
        const oldIndex = currentConfigs.findIndex((config) => config.id === active.id);
        const newIndex = currentConfigs.findIndex((config) => config.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return currentConfigs;
        return arrayMove(currentConfigs, oldIndex, newIndex);
      });
    }
  };

  const handleAddStageConfig = () => {
    if (!newStageName.trim()) {
      toast({ title: "Error", description: "Stage name cannot be empty.", variant: "destructive" });
      return;
    }
    // Ensure new stage ID is unique, simple example, might need more robust unique ID generation
    const newId = `custom-stage-${Date.now().toString()}`;
    setStageConfigs([
      ...stageConfigs,
      { 
        id: newId, 
        name: newStageName, 
        loanStageEnum: newStageEnum, // Default or selected enum
        defaultTimelineDays: newStageTimeline, 
        requiredDocuments: [] 
      }
    ]);
    setNewStageName('');
    setNewStageTimeline(3);
    // Reset newStageEnum if you add a selector for it
    toast({ title: "Success", description: "New workflow stage added." });
  };

  const handleRemoveStageConfig = (id: string) => {
    setStageConfigs(stageConfigs.filter(config => config.id !== id));
    toast({ title: "Success", description: "Workflow stage removed." });
  };

  const handleStageConfigChange = (id: string, field: keyof StageConfig, value: any) => {
    setStageConfigs(configs => configs.map(config => 
      config.id === id ? { ...config, [field]: value } : config
    ));
  };

  const handleAddRequiredDocument = (stageId: string, docName: string) => {
    setStageConfigs(configs => configs.map(config => {
      if (config.id === stageId) {
        const newDoc: RequiredDocumentConfig = { id: `req-doc-${Date.now()}`, name: docName };
        return { ...config, requiredDocuments: [...config.requiredDocuments, newDoc] };
      }
      return config;
    }));
  };

  const handleRemoveRequiredDocument = (stageId: string, docId: string) => {
     setStageConfigs(configs => configs.map(config => {
      if (config.id === stageId) {
        return { ...config, requiredDocuments: config.requiredDocuments.filter(doc => doc.id !== docId) };
      }
      return config;
    }));
  };
  
  const handleRequiredDocumentNameChange = (stageId: string, docId: string, newName: string) => {
    setStageConfigs(configs => configs.map(config => {
      if (config.id === stageId) {
        return {
          ...config,
          requiredDocuments: config.requiredDocuments.map(doc =>
            doc.id === docId ? { ...doc, name: newName } : doc
          )
        };
      }
      return config;
    }));
  };
  
  const handleSaveChanges = () => {
    // In a real app, send stageConfigs to the backend
    console.log("Settings saved:", { stageConfigs, enableNotifications, overdueThreshold });
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
          Configure loan workflows, timelines, required documents, and notification preferences.
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
            <CardDescription>Define and reorder stages, default timelines, and required documents. Drag to reorder stages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SortableContext
              items={stageConfigs.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <Accordion type="single" collapsible className="w-full">
                {stageConfigs.map((config) => (
                  <DraggableAccordionItem
                    key={config.id}
                    stageConfig={config}
                    handleStageConfigChange={handleStageConfigChange}
                    handleRemoveStageConfig={handleRemoveStageConfig}
                    handleAddRequiredDocument={handleAddRequiredDocument}
                    handleRemoveRequiredDocument={handleRemoveRequiredDocument}
                    handleRequiredDocumentNameChange={handleRequiredDocumentNameChange}
                  />
                ))}
              </Accordion>
            </SortableContext>

            <Separator />
            
            <div className="space-y-2 p-4 border rounded-lg bg-muted/20">
              <h4 className="font-medium">Add New Stage</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="sm:col-span-2">
                  <Label htmlFor="new-stage-name">Stage Name</Label>
                  <Input 
                    id="new-stage-name" 
                    value={newStageName} 
                    onChange={(e) => setNewStageName(e.target.value)} 
                    placeholder="e.g., Final Verification"
                    className="mt-1" 
                  />
                </div>
                 {/* TODO: Add a select for LoanStage enum for newStageEnum */}
                <div>
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
                <Button onClick={handleAddStageConfig} className="w-full sm:w-auto sm:col-span-3">
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

