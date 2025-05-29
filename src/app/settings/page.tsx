
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, PlusCircle, Trash2, AlertTriangle, Save, Clock, GripVertical, FileText, Users, Percent } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
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
  percentageWeight: number;
}

export const initialStageConfigs: StageConfig[] = [
  { id: 'application_submitted', name: 'Application Submitted', loanStageEnum: LoanStage.APPLICATION_SUBMITTED, defaultTimelineDays: 2, requiredDocuments: [{id: 'doc_id_card', name: 'Identification Card'}], targetRoleForStage: UserRole.RELATIONSHIP_MANAGER, percentageWeight: 10 },
  { id: 'document_collection', name: 'Document Collection', loanStageEnum: LoanStage.DOCUMENT_COLLECTION, defaultTimelineDays: 7, requiredDocuments: [{id: 'doc_proof_income', name: 'Proof of Income'}, {id: 'doc_bank_statement', name: 'Bank Statement'}], targetRoleForStage: UserRole.RELATIONSHIP_MANAGER, percentageWeight: 20 },
  { id: 'under_review', name: 'Under Review', loanStageEnum: LoanStage.UNDER_REVIEW, defaultTimelineDays: 5, requiredDocuments: [], targetRoleForStage: UserRole.UNDERWRITER, percentageWeight: 30 },
  { id: 'additional_info_required', name: 'Additional Info Required', loanStageEnum: LoanStage.ADDITIONAL_INFO_REQUIRED, defaultTimelineDays: 3, requiredDocuments: [], percentageWeight: 5 },
  { id: 'approved', name: 'Approved', loanStageEnum: LoanStage.APPROVED, defaultTimelineDays: 3, requiredDocuments: [{id: 'doc_loan_agreement', name: 'Signed Loan Agreement'}], targetRoleForStage: UserRole.RELATIONSHIP_MANAGER, percentageWeight: 20 },
  { id: 'rejected', name: 'Rejected', loanStageEnum: LoanStage.REJECTED, defaultTimelineDays: 1, requiredDocuments: [], percentageWeight: 0 },
  { id: 'funds_disbursed', name: 'Funds Disbursed', loanStageEnum: LoanStage.FUNDS_DISBURSED, defaultTimelineDays: 1, requiredDocuments: [], targetRoleForStage: UserRole.STAFF, percentageWeight: 15 },
];

const NO_SPECIFIC_ROLE_VALUE = "---NO_SPECIFIC_ROLE---";

interface DraggableStageConfigItemProps {
  stageConfig: StageConfig;
  onStageConfigChange: (id: string, field: keyof StageConfig, value: any) => void;
  onRemoveStageConfig: (id: string) => void;
  onAddRequiredDocument: (stageId: string, docName: string) => void;
  onRemoveRequiredDocument: (stageId: string, docId: string) => void;
  onRequiredDocumentNameChange: (stageId: string, docId: string, newName: string) => void;
}

function DraggableStageConfigItem({
  stageConfig,
  onStageConfigChange,
  onRemoveStageConfig,
  onAddRequiredDocument,
  onRemoveRequiredDocument,
  onRequiredDocumentNameChange,
}: DraggableStageConfigItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stageConfig.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 'auto', opacity: isDragging ? 0.8 : 1, position: 'relative' as 'relative' };
  const [newReqDocName, setNewReqDocName] = useState('');

  const handleAddDoc = () => {
    if (newReqDocName.trim()) {
      onAddRequiredDocument(stageConfig.id, newReqDocName.trim());
      setNewReqDocName('');
    }
  };

  return (
    <AccordionItem value={stageConfig.id} key={stageConfig.id} ref={setNodeRef} style={style} className="bg-card border rounded-md mb-2 shadow-sm">
      <AccordionTrigger className="hover:no-underline w-full data-[state=open]:border-b">
        <div className="flex items-center justify-between w-full pr-4 py-2">
          <div className="flex items-center" {...attributes} {...listeners} >
            <GripVertical className="h-5 w-5 text-muted-foreground mr-3 cursor-grab" />
            <span>{stageConfig.name}</span>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {stageConfig.targetRoleForStage && <Users className="h-4 w-4"/>}{stageConfig.targetRoleForStage || 'Any Role'} | <Clock className="h-4 w-4"/>{stageConfig.defaultTimelineDays} days | <Percent className="h-4 w-4" />{stageConfig.percentageWeight || 0}% | <FileText className="h-4 w-4"/>{stageConfig.requiredDocuments.length} doc(s)
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 p-4 bg-background rounded-b-md">
        {/* Inputs for stage name, timeline, weight, target role */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor={`stage-name-${stageConfig.id}`}>Stage Name</Label>
            <Input id={`stage-name-${stageConfig.id}`} value={stageConfig.name} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageConfigChange(stageConfig.id, 'name', e.target.value)} className="mt-1"/>
          </div>
          <div>
            <Label htmlFor={`stage-timeline-${stageConfig.id}`}>Default Timeline (days)</Label>
            <Input id={`stage-timeline-${stageConfig.id}`} type="number" value={stageConfig.defaultTimelineDays} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageConfigChange(stageConfig.id, 'defaultTimelineDays', parseInt(e.target.value,10) || 0)} className="mt-1" min="0"/>
          </div>
          <div>
            <Label htmlFor={`stage-weight-${stageConfig.id}`}>Percentage Weight (%)</Label>
            <Input id={`stage-weight-${stageConfig.id}`} type="number" value={stageConfig.percentageWeight} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageConfigChange(stageConfig.id, 'percentageWeight', parseInt(e.target.value,10) || 0)} className="mt-1" min="0" max="100"/>
          </div>
        </div>
         <div>
            <Label htmlFor={`target-role-${stageConfig.id}`}>Target Role for this Stage</Label>
            <Select value={stageConfig.targetRoleForStage || NO_SPECIFIC_ROLE_VALUE} onValueChange={(value) => onStageConfigChange(stageConfig.id, 'targetRoleForStage', value === NO_SPECIFIC_ROLE_VALUE ? undefined : value as UserRole)}>
              <SelectTrigger id={`target-role-${stageConfig.id}`} className="mt-1"><SelectValue placeholder="Select a target role (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SPECIFIC_ROLE_VALUE}>No specific role / Keep current</SelectItem>
                {Object.values(UserRole).map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">If set, loans entering this stage may be auto-assigned.</p>
          </div>
        <Separator />
        {/* Required Documents Management */}
        <div>
          <h5 className="text-md font-medium mb-2">Required Documents for this Stage</h5>
          {stageConfig.requiredDocuments.length === 0 && (<p className="text-sm text-muted-foreground">No documents required.</p>)}
          <ul className="space-y-2">
            {stageConfig.requiredDocuments.map(doc => (
              <li key={doc.id} className="flex items-center gap-2 p-2 border rounded-md">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Input value={doc.name} onChange={(e) => onRequiredDocumentNameChange(stageConfig.id, doc.id, e.target.value)} className="flex-grow text-sm" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}/>
                <Button variant="ghost" size="icon" onClick={() => onRemoveRequiredDocument(stageConfig.id, doc.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-2 mt-4">
            <div className="flex-grow">
              <Label htmlFor={`new-req-doc-${stageConfig.id}`}>New Document Name</Label>
              <Input id={`new-req-doc-${stageConfig.id}`} value={newReqDocName} onChange={(e) => setNewReqDocName(e.target.value)} placeholder="e.g., Passport" className="mt-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}/>
            </div>
            <Button onClick={handleAddDoc} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Document</Button>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => onRemoveStageConfig(stageConfig.id)} className="mt-4"><Trash2 className="mr-2 h-4 w-4" /> Remove Stage</Button>
      </AccordionContent>
    </AccordionItem>
  );
}

interface AddNewStageFormProps {
    onAddStage: (name: string, enumVal: LoanStage, timeline: number, weight: number, targetRole?: UserRole) => void;
}

function AddNewStageForm({ onAddStage }: AddNewStageFormProps) {
    const [name, setName] = useState('');
    const [timeline, setTimeline] = useState(3);
    const [weight, setWeight] = useState(0);
    const [enumVal, setEnumVal] = useState<LoanStage>(LoanStage.APPLICATION_SUBMITTED);
    const [targetRole, setTargetRole] = useState<UserRole | undefined>(undefined);
    const { toast } = useToast();

    const handleSubmit = () => {
        if (!name.trim()) {
            toast({ title: "Error", description: "Stage name cannot be empty.", variant: "destructive" });
            return;
        }
        onAddStage(name, enumVal, timeline, weight, targetRole);
        setName(''); setTimeline(3); setWeight(0); setTargetRole(undefined);
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <h4 className="font-medium">Add New Stage</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div><Label htmlFor="new-stage-name">Stage Name</Label><Input id="new-stage-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Final Verification" className="mt-1"/></div>
                <div><Label htmlFor="new-stage-enum">Corresponds to (Loan Stage Type)</Label><Select value={enumVal} onValueChange={(v) => setEnumVal(v as LoanStage)}><SelectTrigger id="new-stage-enum" className="mt-1"><SelectValue placeholder="Select base stage type" /></SelectTrigger><SelectContent>{Object.values(LoanStage).map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select></div>
                <div><Label htmlFor="new-stage-timeline">Timeline (days)</Label><Input id="new-stage-timeline" type="number" value={timeline} onChange={(e) => setTimeline(parseInt(e.target.value,10) || 0)} className="mt-1" min="0"/></div>
                <div><Label htmlFor="new-stage-percentage-weight">Percentage Weight (%)</Label><Input id="new-stage-percentage-weight" type="number" value={weight} onChange={(e) => {let val = parseInt(e.target.value,10) || 0; if (val < 0) val = 0; if (val > 100) val = 100; setWeight(val);}} className="mt-1" min="0" max="100"/></div>
                <div><Label htmlFor="new-stage-target-role">Target Role</Label><Select value={targetRole || NO_SPECIFIC_ROLE_VALUE} onValueChange={(v) => setTargetRole(v === NO_SPECIFIC_ROLE_VALUE ? undefined : v as UserRole)}><SelectTrigger id="new-stage-target-role" className="mt-1"><SelectValue placeholder="Select target role (optional)" /></SelectTrigger><SelectContent><SelectItem value={NO_SPECIFIC_ROLE_VALUE}>No specific role</SelectItem>{Object.values(UserRole).map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent></Select></div>
                <Button onClick={handleSubmit} className="w-full sm:w-auto mt-4 lg:col-span-1 self-end"><PlusCircle className="mr-2 h-4 w-4" /> Add Stage</Button>
            </div>
        </div>
    );
}


export default function SettingsPage() {
  const { toast } = useToast();
  const [stageConfigs, setStageConfigs] = useState<StageConfig[]>(initialStageConfigs);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [overdueThreshold, setOverdueThreshold] = useState(2);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const currentTotalWeight = useMemo(() => stageConfigs.reduce((sum, config) => sum + (Number(config.percentageWeight) || 0), 0), [stageConfigs]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStageConfigs((currentConfigs) => {
        const oldIndex = currentConfigs.findIndex((config) => config.id === active.id);
        const newIndex = currentConfigs.findIndex((config) => config.id === over.id);
        return (oldIndex === -1 || newIndex === -1) ? currentConfigs : arrayMove(currentConfigs, oldIndex, newIndex);
      });
    }
  }, []);

  const handleAddStageConfig = useCallback((name: string, enumVal: LoanStage, timeline: number, weight: number, targetRole?: UserRole) => {
    const newId = `custom-stage-${Date.now().toString()}`;
    setStageConfigs(prev => [...prev, { id: newId, name, loanStageEnum: enumVal, defaultTimelineDays: timeline, percentageWeight: weight, requiredDocuments: [], targetRoleForStage: targetRole }]);
    toast({ title: "Success", description: "New workflow stage added." });
  }, [toast]);

  const handleRemoveStageConfig = useCallback((id: string) => {
    setStageConfigs(prev => prev.filter(config => config.id !== id));
    toast({ title: "Success", description: "Workflow stage removed." });
  }, [toast]);

  const handleStageConfigChange = useCallback((id: string, field: keyof StageConfig, value: any) => {
    let parsedValue = value;
    if (field === 'defaultTimelineDays' || field === 'percentageWeight') {
      parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue)) parsedValue = 0;
      if (field === 'percentageWeight') { parsedValue = Math.min(100, Math.max(0, parsedValue)); }
      if (field === 'defaultTimelineDays' && parsedValue < 0) parsedValue = 0;
    }
    setStageConfigs(configs => configs.map(config => config.id === id ? { ...config, [field]: parsedValue } : config));
  }, []);

  const handleAddRequiredDocument = useCallback((stageId: string, docName: string) => {
    setStageConfigs(configs => configs.map(config => config.id === stageId ? { ...config, requiredDocuments: [...config.requiredDocuments, { id: `req-doc-${Date.now()}`, name: docName }] } : config));
  }, []);

  const handleRemoveRequiredDocument = useCallback((stageId: string, docId: string) => {
     setStageConfigs(configs => configs.map(config => config.id === stageId ? { ...config, requiredDocuments: config.requiredDocuments.filter(doc => doc.id !== docId) } : config));
  }, []);

  const handleRequiredDocumentNameChange = useCallback((stageId: string, docId: string, newName: string) => {
    setStageConfigs(configs => configs.map(config => config.id === stageId ? { ...config, requiredDocuments: config.requiredDocuments.map(doc => doc.id === docId ? { ...doc, name: newName } : doc)} : config));
  }, []);

  const handleSaveChanges = () => {
    if (currentTotalWeight > 100) {
      toast({ title: "Validation Error", description: `Total percentage weight (${currentTotalWeight}%) exceeds 100%. Adjust weights.`, variant: "destructive", duration: 5000 });
      return;
    }
    console.log("Settings saved (mock):", { stageConfigs, enableNotifications, overdueThreshold });
    toast({ title: "Settings Saved (Mock)", description: "Workflow and notification settings updated.", action: <Check className="h-5 w-5 text-green-500" /> });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure loan workflows, timelines, required documents, and notification preferences.</p>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Card>
          <CardHeader>
            <CardTitle>Workflow Configuration</CardTitle>
            <CardDescription>Define stages, timelines, weights, documents, and roles. Drag to reorder. Current Total Weight: <span className={`font-semibold ${currentTotalWeight > 100 ? 'text-destructive' : 'text-green-600'}`}>{currentTotalWeight}%</span></CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SortableContext items={stageConfigs.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <Accordion type="single" collapsible className="w-full">
                {stageConfigs.map((config) => (
                  <DraggableStageConfigItem key={config.id} stageConfig={config} onStageConfigChange={handleStageConfigChange} onRemoveStageConfig={handleRemoveStageConfig} onAddRequiredDocument={handleAddRequiredDocument} onRemoveRequiredDocument={handleRemoveRequiredDocument} onRequiredDocumentNameChange={handleRequiredDocumentNameChange} />
                ))}
              </Accordion>
            </SortableContext>
            <Separator />
            <AddNewStageForm onAddStage={handleAddStageConfig} />
          </CardContent>
        </Card>
      </DndContext>
      {/* Notification Settings Card */}
      <Card>
        <CardHeader><CardTitle>Notification Settings</CardTitle><CardDescription>Manage how and when notifications are sent for overdue tasks.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div><Label htmlFor="enable-notifications" className="font-medium">Enable Overdue Notifications</Label><p className="text-sm text-muted-foreground">Receive alerts for loan processes exceeding their timeline.</p></div>
            <Switch id="enable-notifications" checked={enableNotifications} onCheckedChange={setEnableNotifications}/>
          </div>
          {enableNotifications && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/20">
              <Label htmlFor="overdue-threshold">Notify if overdue by (days)</Label>
              <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" /><Input id="overdue-threshold" type="number" value={overdueThreshold} onChange={(e) => setOverdueThreshold(parseInt(e.target.value,10))} className="max-w-xs" min="1"/></div>
              <p className="text-xs text-muted-foreground">Notifications will be triggered if a loan stage is {overdueThreshold} or more days past its deadline.</p>
            </div>
          )}
          <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 rounded-r-md">
             <div className="flex items-start"><AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5 flex-shrink-0" /><div><h5 className="font-semibold text-yellow-700 dark:text-yellow-300">System Note</h5><p className="text-sm text-yellow-600 dark:text-yellow-400">Actual notification delivery needs backend integration. This configures triggers.</p></div></div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={handleSaveChanges} size="lg"><Save className="mr-2 h-4 w-4" /> Save All Settings</Button></div>
    </div>
  );
}
