
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, PlusCircle, Trash2, AlertTriangle, Save, Clock, GripVertical, FileText, Users } from 'lucide-react';
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
import { LoanStage, UserRole } from '@/types/loan';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RequiredDocumentConfig {
  id: string;
  name: string;
}

export interface StageConfig {
  id: string; 
  name: string; 
  loanStageEnum: LoanStage; 
  defaultTimelineDays: number;
  requiredDocuments: RequiredDocumentConfig[];
  targetRoleForStage?: UserRole; 
}

export const initialStageConfigs: StageConfig[] = [
  { id: 'application_submitted', name: 'Application Submitted', loanStageEnum: LoanStage.APPLICATION_SUBMITTED, defaultTimelineDays: 2, requiredDocuments: [{id: 'doc_id_card', name: 'Identification Card'}], targetRoleForStage: UserRole.RELATIONSHIP_MANAGER },
  { id: 'document_collection', name: 'Document Collection', loanStageEnum: LoanStage.DOCUMENT_COLLECTION, defaultTimelineDays: 7, requiredDocuments: [{id: 'doc_proof_income', name: 'Proof of Income'}, {id: 'doc_bank_statement', name: 'Bank Statement'}], targetRoleForStage: UserRole.RELATIONSHIP_MANAGER },
  { id: 'under_review', name: 'Under Review', loanStageEnum: LoanStage.UNDER_REVIEW, defaultTimelineDays: 5, requiredDocuments: [], targetRoleForStage: UserRole.UNDERWRITER },
  { id: 'additional_info_required', name: 'Additional Info Required', loanStageEnum: LoanStage.ADDITIONAL_INFO_REQUIRED, defaultTimelineDays: 3, requiredDocuments: [] }, 
  { id: 'approved', name: 'Approved', loanStageEnum: LoanStage.APPROVED, defaultTimelineDays: 3, requiredDocuments: [{id: 'doc_loan_agreement', name: 'Signed Loan Agreement'}], targetRoleForStage: UserRole.RELATIONSHIP_MANAGER },
  { id: 'rejected', name: 'Rejected', loanStageEnum: LoanStage.REJECTED, defaultTimelineDays: 1, requiredDocuments: [] },
  { id: 'funds_disbursed', name: 'Funds Disbursed', loanStageEnum: LoanStage.FUNDS_DISBURSED, defaultTimelineDays: 1, requiredDocuments: [], targetRoleForStage: UserRole.STAFF },
];

const NO_SPECIFIC_ROLE_VALUE = "---NO_SPECIFIC_ROLE---";

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
          <div className="flex items-center" {...attributes} {...listeners} >
            <GripVertical className="h-5 w-5 text-muted-foreground mr-3 cursor-grab" />
            <span>{stageConfig.name}</span>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {stageConfig.targetRoleForStage && <Users className="h-4 w-4"/>}
            {stageConfig.targetRoleForStage || 'Any Role'}
            <span className="mx-1">|</span>
            <Clock className="h-4 w-4"/> 
            {stageConfig.defaultTimelineDays} days
             <span className="mx-1">|</span>
            <FileText className="h-4 w-4"/> 
            {stageConfig.requiredDocuments.length} doc(s)
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 p-4 bg-background rounded-b-md">
        <div className="grid md:grid-cols-2 gap-4">
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
        </div>
         <div>
            <Label htmlFor={`target-role-${stageConfig.id}`}>Target Role for this Stage</Label>
            <Select
              value={stageConfig.targetRoleForStage || NO_SPECIFIC_ROLE_VALUE}
              onValueChange={(value) => handleStageConfigChange(stageConfig.id, 'targetRoleForStage', value === NO_SPECIFIC_ROLE_VALUE ? undefined : value as UserRole)}
            >
              <SelectTrigger id={`target-role-${stageConfig.id}`} className="mt-1">
                <SelectValue placeholder="Select a target role (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SPECIFIC_ROLE_VALUE}>No specific role / Keep current</SelectItem>
                {Object.values(UserRole).map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">If set, loans entering this stage will try to assign to a user with this role.</p>
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
  const [stageConfigs, setStageConfigs] = useState<StageConfig[]>(initialStageConfigs); 
  const [newStageName, setNewStageName] = useState('');
  const [newStageTimeline, setNewStageTimeline] = useState(3);
  const [newStageEnum, setNewStageEnum] = useState<LoanStage>(LoanStage.APPLICATION_SUBMITTED);
  const [newStageTargetRole, setNewStageTargetRole] = useState<UserRole | undefined>(undefined);


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
    const newId = `custom-stage-${Date.now().toString()}`;
    setStageConfigs([
      ...stageConfigs,
      { 
        id: newId, 
        name: newStageName, 
        loanStageEnum: newStageEnum, 
        defaultTimelineDays: newStageTimeline, 
        requiredDocuments: [],
        targetRoleForStage: newStageTargetRole,
      }
    ]);
    setNewStageName('');
    setNewStageTimeline(3);
    setNewStageTargetRole(undefined);
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
    console.log("Settings saved:", { stageConfigs, enableNotifications, overdueThreshold });
    toast({
      title: "Settings Saved (Mock)",
      description: "Your workflow and notification settings have been updated in local state.",
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
            <CardDescription>Define and reorder stages, default timelines, required documents, and target roles. Drag to reorder stages.</CardDescription>
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
            
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <h4 className="font-medium">Add New Stage</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <Label htmlFor="new-stage-name">Stage Name</Label>
                  <Input 
                    id="new-stage-name" 
                    value={newStageName} 
                    onChange={(e) => setNewStageName(e.target.value)} 
                    placeholder="e.g., Final Verification"
                    className="mt-1" 
                  />
                </div>
                 <div>
                  <Label htmlFor="new-stage-enum">Corresponds to (Loan Stage Type)</Label>
                    <Select
                        value={newStageEnum}
                        onValueChange={(value) => setNewStageEnum(value as LoanStage)}
                    >
                        <SelectTrigger id="new-stage-enum" className="mt-1">
                            <SelectValue placeholder="Select base stage type" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.values(LoanStage).map(stage => (
                            <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                  <Label htmlFor="new-stage-timeline">Timeline (days)</Label>
                  <Input 
                    id="new-stage-timeline" 
                    type="number" 
                    value={newStageTimeline} 
                    onChange={(e) => setNewStageTimeline(parseInt(e.target.value, 10) || 1)} 
                    className="mt-1"
                    min="1"
                  />
                </div>
                <div>
                    <Label htmlFor="new-stage-target-role">Target Role for New Stage</Label>
                    <Select
                        value={newStageTargetRole || NO_SPECIFIC_ROLE_VALUE}
                        onValueChange={(value) => setNewStageTargetRole(value === NO_SPECIFIC_ROLE_VALUE ? undefined : value as UserRole)}
                    >
                        <SelectTrigger id="new-stage-target-role" className="mt-1">
                            <SelectValue placeholder="Select target role (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_SPECIFIC_ROLE_VALUE}>No specific role</SelectItem>
                            {Object.values(UserRole).map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                </div>
                 <Button onClick={handleAddStageConfig} className="w-full sm:w-auto mt-4">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Stage
                </Button>
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
    

    